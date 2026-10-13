import XCTest

final class LaunchTests: XCTestCase {
    override func setUpWithError() throws { continueAfterFailure = false }
    override func tearDownWithError() throws {
        let app = XCUIApplication()
        print("App accessibility tree: \(app.debugDescription)")
        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.lifetime = .keepAlways
        add(attachment)
    }

    func testOfflineLaunchAndOriginalPreview() {
        let app = XCUIApplication()
        app.launchArguments = ["--uitesting-reset"]
        app.launch()
        let start = app.buttons["开始第一个故事"].firstMatch
        XCTAssertTrue(start.waitForExistence(timeout: 30))
        start.tap()
        let preview = app.buttons["查看完整图片"].firstMatch
        if !preview.isHittable { app.webViews.firstMatch.swipeUp() }
        XCTAssertTrue(preview.waitForExistence(timeout: 10))
        preview.tap()
        XCTAssertTrue(app.buttons["返回关卡准备"].firstMatch.waitForExistence(timeout: 10))
        app.buttons["返回关卡准备"].firstMatch.tap()
        let play = app.buttons["开始拼图"].firstMatch
        if !play.isHittable { app.webViews.firstMatch.swipeUp() }
        play.tap()
        XCTAssertTrue(app.buttons["查看原图"].firstMatch.waitForExistence(timeout: 10))
        XCTAssertTrue(app.buttons["提交拼图"].firstMatch.exists)
    }

    func testNativeImageImportMenu() {
        let app = XCUIApplication()
        app.launchArguments = ["--uitesting-reset"]
        app.launch()
        XCTAssertTrue(app.buttons["浏览故事"].firstMatch.waitForExistence(timeout: 30))
        app.buttons["浏览故事"].firstMatch.tap()
        app.buttons["我的故事集"].firstMatch.tap()
        app.buttons["新建"].firstMatch.tap()
        // WebKit appends its localized file-input description to this label.
        // Tap the actual control rather than its covered StaticText child.
        let add = app.webViews.buttons.matching(
            NSPredicate(format: "label CONTAINS %@", "添加图片")
        ).firstMatch
        XCTAssertTrue(add.waitForExistence(timeout: 10))
        add.tap()
        XCTAssertTrue(app.buttons["照片图库"].firstMatch.waitForExistence(timeout: 10))
        XCTAssertTrue(app.buttons["文件"].firstMatch.exists)
        app.buttons["取消"].firstMatch.tap()
    }
}
