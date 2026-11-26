// swift-tools-version:5.7
import PackageDescription

let package = Package(
    name: "tauri-plugin-web-sheet",
    platforms: [.iOS(.v15)],
    products: [
        .library(name: "tauri-plugin-web-sheet", type: .static, targets: ["tauri-plugin-web-sheet"]),
    ],
    dependencies: [
        .package(name: "Tauri", path: "../.tauri/tauri-api"),
    ],
    targets: [
        .target(name: "tauri-plugin-web-sheet", dependencies: [.byName(name: "Tauri")], path: "Sources"),
    ]
)
