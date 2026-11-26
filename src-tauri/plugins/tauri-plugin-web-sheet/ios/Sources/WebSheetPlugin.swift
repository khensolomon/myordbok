// A web page in Apple's sign-in sheet (ASWebAuthenticationSession), over
// the app: the reader signs in without leaving MyOrdbok, and the sheet
// shares Safari's sign-ins (Google, Apple, GitHub already signed in stay so).
//
// open resolves when the sheet closes: on an address with the callback
// scheme (myordbok://…, the website's way to end it), or closed by the
// reader or by close (the app saw the sign-in finish on its own).
import AuthenticationServices
import Tauri
import UIKit

class OpenArgs: Decodable {
    let url: String
    let callbackScheme: String
}

class WebSheetPlugin: Plugin, ASWebAuthenticationPresentationContextProviding {
    private var session: ASWebAuthenticationSession?

    @objc public func open(_ invoke: Invoke) throws {
        let args = try invoke.parseArgs(OpenArgs.self)
        guard let url = URL(string: args.url), url.scheme == "https" else {
            invoke.reject("Not an https address: \(args.url)")
            return
        }
        DispatchQueue.main.async {
            self.session?.cancel()
            let session = ASWebAuthenticationSession(url: url, callbackURLScheme: args.callbackScheme) { callback, error in
                self.session = nil
                if let callback = callback {
                    let result: JsonObject = ["closed": "callback", "url": callback.absoluteString]
                    invoke.resolve(result)
                } else if let error = error as? ASWebAuthenticationSessionError, error.code == .canceledLogin {
                    let result: JsonObject = ["closed": "cancelled"]
                    invoke.resolve(result)
                } else {
                    invoke.reject(error?.localizedDescription ?? "The sign-in sheet closed unexpectedly")
                }
            }
            session.presentationContextProvider = self
            session.prefersEphemeralWebBrowserSession = false
            self.session = session
            if !session.start() {
                self.session = nil
                invoke.reject("The sign-in sheet could not open")
            }
        }
    }

    @objc public func close(_ invoke: Invoke) {
        DispatchQueue.main.async {
            self.session?.cancel()
            self.session = nil
            invoke.resolve()
        }
    }

    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        if let window = self.manager.viewController?.view.window { return window }
        let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
        return scenes.flatMap { $0.windows }.first { $0.isKeyWindow } ?? ASPresentationAnchor()
    }
}

// Public: a release build keeps it (an internal one is dropped, as the iap
// plugin's was).
@_cdecl("init_plugin_web_sheet")
public func initPlugin() -> Plugin {
    return WebSheetPlugin()
}
