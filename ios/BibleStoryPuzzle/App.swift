import SwiftUI

@main
struct BibleStoryPuzzleApp: App {
    var body: some Scene {
        WindowGroup { PuzzleHost().background(Color(uiColor: .systemGroupedBackground)) }
    }
}

struct PuzzleHost: UIViewControllerRepresentable {
    func makeUIViewController(context: Context) -> PuzzleViewController { PuzzleViewController() }
    func updateUIViewController(_ uiViewController: PuzzleViewController, context: Context) {}
}
