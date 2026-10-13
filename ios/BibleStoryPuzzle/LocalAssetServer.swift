import Foundation
import Network

/// Stable loopback origin gives WebKit a persistent, standard IndexedDB origin.
/// Only bundled assets are served. No user photos or data directories are exposed.
final class LocalAssetServer {
    static let origin = URL(string: "http://127.0.0.1:18765")!
    private let root: URL
    private let queue = DispatchQueue(label: "puzzle.assets")
    private var listener: NWListener?
    private var clients: [UUID: NWConnection] = [:]

    init(root: URL) { self.root = root.standardizedFileURL }

    func start(completion: @escaping (Result<Void, Error>) -> Void) {
        do {
            let parameters = NWParameters.tcp
            parameters.requiredLocalEndpoint = .hostPort(host: .ipv4(.loopback), port: 18765)
            let listener = try NWListener(using: parameters)
            self.listener = listener
            var reported = false
            listener.stateUpdateHandler = { state in
                switch state {
                case .ready:
                    if !reported { reported = true; DispatchQueue.main.async { completion(.success(())) } }
                case .failed(let error):
                    if !reported { reported = true; DispatchQueue.main.async { completion(.failure(error)) } }
                default: break
                }
            }
            listener.newConnectionHandler = { [weak self] connection in self?.accept(connection) }
            listener.start(queue: queue)
        } catch { DispatchQueue.main.async { completion(.failure(error)) } }
    }

    func stop() {
        queue.async { [weak self] in
            self?.listener?.cancel(); self?.listener = nil
            self?.clients.values.forEach { $0.cancel() }; self?.clients.removeAll()
        }
    }

    private func accept(_ connection: NWConnection) {
        let id = UUID(); clients[id] = connection
        connection.stateUpdateHandler = { [weak self] state in
            if case .failed = state { connection.cancel(); self?.clients.removeValue(forKey: id) }
            if case .cancelled = state { self?.clients.removeValue(forKey: id) }
        }
        connection.start(queue: queue)
        receive(connection, accumulated: Data())
        queue.asyncAfter(deadline: .now() + 10) { [weak self] in
            if self?.clients[id] != nil { connection.cancel(); self?.clients.removeValue(forKey: id) }
        }
    }

    private func receive(_ connection: NWConnection, accumulated: Data) {
        connection.receive(minimumIncompleteLength: 1, maximumLength: 8192) { [weak self] data, _, complete, error in
            guard let self else { return }
            var request = accumulated; request.append(data ?? Data())
            guard request.count <= 16384 else { self.send(connection, status: "413 Payload Too Large"); return }
            if request.range(of: Data("\r\n\r\n".utf8)) != nil { self.respond(connection, request: request) }
            else if complete || error != nil { connection.cancel() }
            else { self.receive(connection, accumulated: request) }
        }
    }

    private func respond(_ connection: NWConnection, request: Data) {
        guard let text = String(data: request, encoding: .utf8),
              let line = text.components(separatedBy: "\r\n").first else { connection.cancel(); return }
        let words = line.split(separator: " ")
        guard words.count == 3, ["GET", "HEAD"].contains(String(words[0])) else { send(connection, status: "405 Method Not Allowed"); return }
        let raw = String(words[1]).components(separatedBy: "?")[0]
        guard raw.hasPrefix("/"), let path = raw.removingPercentEncoding,
              !path.contains("\0"), !path.contains("\\"), !path.split(separator: "/").contains("..") else {
            send(connection, status: "400 Bad Request"); return
        }
        let relative = path == "/" ? "index.html" : String(path.dropFirst())
        let file = root.appendingPathComponent(relative).standardizedFileURL
        guard file.path.hasPrefix(root.path + "/"), let data = try? Data(contentsOf: file) else {
            send(connection, status: "404 Not Found"); return
        }
        let types = ["html":"text/html; charset=utf-8", "css":"text/css; charset=utf-8", "js":"text/javascript; charset=utf-8", "json":"application/json", "jpg":"image/jpeg", "png":"image/png", "webp":"image/webp"]
        send(connection, status: "200 OK", body: data, type: types[file.pathExtension] ?? "application/octet-stream", headOnly: words[0] == "HEAD")
    }

    private func send(_ connection: NWConnection, status: String, body: Data = Data(), type: String = "text/plain", headOnly: Bool = false) {
        let headers = "HTTP/1.1 \(status)\r\nContent-Type: \(type)\r\nContent-Length: \(body.count)\r\nConnection: close\r\nCache-Control: no-cache\r\nX-Content-Type-Options: nosniff\r\n\r\n"
        var response = Data(headers.utf8); if !headOnly { response.append(body) }
        connection.send(content: response, completion: .contentProcessed { _ in connection.cancel() })
    }
}
