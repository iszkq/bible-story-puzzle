import UIKit
import WebKit
import PhotosUI
import UniformTypeIdentifiers
import ImageIO
import AVFoundation

final class PuzzleViewController: UIViewController, WKScriptMessageHandler, WKNavigationDelegate, PHPickerViewControllerDelegate, UIDocumentPickerDelegate {
    private var webView: WKWebView!
    private var server: LocalAssetServer?
    private var pickerInput = "add-images"
    private var loading = UIActivityIndicatorView(style: .large)
    private var player: AVAudioPlayer?
    private var importInProgress = false

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemGroupedBackground
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .default()
        config.userContentController.add(self, name: "puzzle")
        webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = self
        webView.isOpaque = false
        webView.backgroundColor = .systemGroupedBackground
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.scrollView.isScrollEnabled = false
        webView.allowsBackForwardNavigationGestures = false
        webView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(webView)
        NSLayoutConstraint.activate([
            webView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            webView.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor),
            webView.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor)
        ])
        loading.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(loading)
        NSLayoutConstraint.activate([loading.centerXAnchor.constraint(equalTo: view.centerXAnchor), loading.centerYAnchor.constraint(equalTo: view.centerYAnchor)])
        loading.startAnimating()
        NotificationCenter.default.addObserver(self, selector: #selector(saveState), name: UIApplication.willResignActiveNotification, object: nil)
        NotificationCenter.default.addObserver(self, selector: #selector(saveState), name: UIApplication.didEnterBackgroundNotification, object: nil)
        if ProcessInfo.processInfo.arguments.contains("--uitesting-reset") {
            config.websiteDataStore.removeData(ofTypes: WKWebsiteDataStore.allWebsiteDataTypes(), modifiedSince: .distantPast) { [weak self] in self?.startServer() }
        } else { startServer() }
    }

    private func startServer() {
        guard let root = Bundle.main.url(forResource: "Web", withExtension: nil) else { showStartupError(); return }
        server = LocalAssetServer(root: root)
        server?.start { [weak self] result in
            switch result {
            case .success: self?.webView.load(URLRequest(url: LocalAssetServer.origin.appendingPathComponent("index.html")))
            case .failure: self?.showStartupError()
            }
        }
    }

    private func showStartupError() {
        loading.stopAnimating()
        let alert = UIAlertController(title: "暂时无法打开", message: "本机资源未能加载。重试不会删除存档。", preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "重试", style: .default) { [weak self] _ in
            self?.server?.stop(); self?.loading.startAnimating()
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) { self?.startServer() }
        })
        present(alert, animated: true)
    }

    @objc private func saveState() { webView?.evaluateJavaScript("window.persistNativeState?.()", completionHandler: nil) }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) { loading.stopAnimating(); updateTheme() }
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) { loading.startAnimating(); webView.reload() }
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) { showStartupError() }
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        let url = navigationAction.request.url
        decisionHandler(url?.host == "127.0.0.1" && url?.port == 18765 && url?.scheme == "http" ? .allow : .cancel)
    }

    override func traitCollectionDidChange(_ previousTraitCollection: UITraitCollection?) {
        super.traitCollectionDidChange(previousTraitCollection); updateTheme()
    }

    private func updateTheme() {
        guard webView != nil else { return }
        let tokens: [String: UIColor] = ["bg":.systemGroupedBackground, "surface":.secondarySystemGroupedBackground, "text":.label, "muted":.secondaryLabel, "accent":.systemBlue, "border":.separator, "control":.systemGray, "error":.systemRed]
        let colors = tokens.mapValues { color -> String in
            var r: CGFloat = 0, g: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0
            color.resolvedColor(with: traitCollection).getRed(&r, green: &g, blue: &b, alpha: &a)
            return "rgba(\(Int(r*255)),\(Int(g*255)),\(Int(b*255)),\(a))"
        }
        let textScale = min(2.5, UIFont.preferredFont(forTextStyle: .body).pointSize / 17)
        webView.callAsyncJavaScript("window.applyNativeTheme(colors); window.applyNativeTextScale(scale)", arguments: ["colors":colors, "scale":textScale], in: nil, in: .page, completionHandler: nil)
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.frameInfo.isMainFrame, message.frameInfo.request.url?.host == "127.0.0.1",
              let data = message.body as? [String: Any], let type = data["type"] as? String else { return }
        if type == "pickImages", !importInProgress, presentedViewController == nil {
            pickerInput = data["inputID"] as? String ?? "add-images"
            guard ["add-images", "replace-image"].contains(pickerInput) else { return }
            showImportMenu(multiple: data["multiple"] as? Bool ?? false)
        }
        if type == "feedback" { feedback(data) }
    }

    private func feedback(_ data: [String: Any]) {
        let complete = data["event"] as? String == "complete"
        if data["haptic"] as? Bool == true {
            if complete { UINotificationFeedbackGenerator().notificationOccurred(.success) }
            else { UISelectionFeedbackGenerator().selectionChanged() }
        }
        if data["sound"] as? Bool == true, let url = Bundle.main.url(forResource: complete ? "complete" : "place", withExtension: "wav") {
            try? AVAudioSession.sharedInstance().setCategory(.ambient, mode: .default)
            player = try? AVAudioPlayer(contentsOf: url); player?.volume = 0.35; player?.play()
        }
    }

    private func showImportMenu(multiple: Bool) {
        let menu = UIAlertController(title: "选择图片", message: "仅处理你选中的图片，保存在本机。", preferredStyle: .actionSheet)
        menu.addAction(UIAlertAction(title: "照片图库", style: .default) { [weak self] _ in
            var config = PHPickerConfiguration(); config.filter = .images; config.selectionLimit = multiple ? 20 : 1
            config.selection = .ordered
            let picker = PHPickerViewController(configuration: config); picker.delegate = self
            self?.present(picker, animated: true)
        })
        menu.addAction(UIAlertAction(title: "文件", style: .default) { [weak self] _ in
            let picker = UIDocumentPickerViewController(forOpeningContentTypes: [.image], asCopy: true)
            picker.allowsMultipleSelection = multiple; picker.delegate = self
            self?.present(picker, animated: true)
        })
        menu.addAction(UIAlertAction(title: "取消", style: .cancel))
        menu.popoverPresentationController?.sourceView = view
        menu.popoverPresentationController?.sourceRect = CGRect(x: view.bounds.midX, y: view.bounds.midY, width: 1, height: 1)
        present(menu, animated: true)
    }

    func picker(_ picker: PHPickerViewController, didFinishPicking results: [PHPickerResult]) {
        picker.dismiss(animated: true)
        guard !results.isEmpty else { return }
        importInProgress = true
        let input = pickerInput
        let providers = results.map(\.itemProvider)
        // Process one file at a time: retain selection order and bound decode memory.
        func next(_ index: Int) {
            guard index < providers.count else { finishImport(); return }
            providers[index].loadFileRepresentation(forTypeIdentifier: UTType.image.identifier) { [weak self] url, _ in
                let image = url.flatMap { self?.prepareImage($0) }
                DispatchQueue.main.async {
                    guard let self else { return }
                    if let image { self.deliver(image, input: input) { next(index + 1) } }
                    else { self.importError("有一张图片无法读取或超过20MB／4000万像素，已跳过。"); next(index + 1) }
                }
            }
        }
        next(0)
    }

    func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
        guard !urls.isEmpty else { return }
        importInProgress = true; let input = pickerInput
        func next(_ index: Int) {
            guard index < urls.count else { finishImport(); return }
            let url = urls[index]
            DispatchQueue.global(qos: .userInitiated).async { [weak self] in
                let access = url.startAccessingSecurityScopedResource()
                let image = self?.prepareImage(url)
                if access { url.stopAccessingSecurityScopedResource() }
                DispatchQueue.main.async {
                    guard let self else { return }
                    if let image { self.deliver(image, input: input) { next(index + 1) } }
                    else { self.importError("有一张图片无法读取或超过20MB／4000万像素，已跳过。"); next(index + 1) }
                }
            }
        }
        next(0)
    }

    private func finishImport() { importInProgress = false }
    private func importError(_ message: String) {
        webView.callAsyncJavaScript("window.nativeImportError(message)", arguments: ["message":message], in: nil, in: .page, completionHandler: nil)
    }

    private func prepareImage(_ url: URL) -> [String:String]? {
        guard let values = try? url.resourceValues(forKeys: [.fileSizeKey]), (values.fileSize ?? Int.max) <= 20*1024*1024,
              let source = CGImageSourceCreateWithURL(url as CFURL, nil),
              let properties = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString:Any],
              let width = properties[kCGImagePropertyPixelWidth] as? Int,
              let height = properties[kCGImagePropertyPixelHeight] as? Int,
              width > 0, height > 0, Double(width)*Double(height) <= 40_000_000 else { return nil }
        let options: [CFString:Any] = [kCGImageSourceCreateThumbnailFromImageAlways:true, kCGImageSourceCreateThumbnailWithTransform:true, kCGImageSourceThumbnailMaxPixelSize:2560, kCGImageSourceShouldCacheImmediately:true]
        guard let image = CGImageSourceCreateThumbnailAtIndex(source, 0, options as CFDictionary) else { return nil }
        let alpha = [CGImageAlphaInfo.first, .last, .premultipliedFirst, .premultipliedLast].contains(image.alphaInfo)
        let data = alpha ? UIImage(cgImage:image).pngData() : UIImage(cgImage:image).jpegData(compressionQuality:0.94)
        guard let data else { return nil }
        return ["name":url.deletingPathExtension().lastPathComponent+(alpha ? ".png" : ".jpg"), "mime":alpha ? "image/png" : "image/jpeg", "base64":data.base64EncodedString()]
    }

    private func deliver(_ image: [String:String], input: String, completion: @escaping () -> Void) {
        webView.callAsyncJavaScript("await window.receiveNativeImages(inputID, images)", arguments: ["inputID":input, "images":[image]], in: nil, in: .page) { [weak self] result in
            if case .failure = result { self?.importError("图片未能导入，请重试。") }
            completion()
        }
    }
}
