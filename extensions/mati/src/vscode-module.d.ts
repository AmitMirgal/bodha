declare module "vscode" {
	export type Thenable<T> = Promise<T>;
	export interface Disposable {
		dispose(): unknown;
	}
	export interface SecretStorage {
		delete(key: string): Thenable<void>;
		get(key: string): Thenable<string | undefined>;
		store(key: string, value: string): Thenable<void>;
	}
	export interface Memento {
		get<T>(key: string): T | undefined;
		update(key: string, value: unknown): Thenable<void>;
	}
	export interface ExtensionContext {
		extensionPath: string;
		globalState: Memento;
		secrets: SecretStorage;
		subscriptions: Disposable[];
	}
	export interface Webview {
		html: string;
		onDidReceiveMessage(
			listener: (message: { type?: string }) => void
		): Disposable;
		postMessage(message: unknown): Thenable<boolean>;
	}
	export interface WebviewPanel {
		dispose(): void;
		webview: Webview;
	}
	export const commands: {
		registerCommand(
			id: string,
			callback: (...args: never[]) => unknown
		): Disposable;
	};
	export const window: {
		showInformationMessage(message: string): Thenable<string | undefined>;
		showErrorMessage(message: string): Thenable<string | undefined>;
		showInputBox(options: {
			ignoreFocusOut?: boolean;
			placeHolder?: string;
			prompt?: string;
		}): Thenable<string | undefined>;
		showWarningMessage(
			message: string,
			options: { modal?: boolean },
			...items: string[]
		): Thenable<string | undefined>;
		createWebviewPanel(
			viewType: string,
			title: string,
			column: number,
			options: { enableScripts: boolean }
		): WebviewPanel;
	};
	export const env: {
		openExternal(target: { toString(): string }): Thenable<boolean>;
	};
	export const workspace: {
		workspaceFolders?: Array<{ uri: { fsPath: string } }>;
	};
	export const Uri: {
		parse(value: string): { toString(): string };
	};
}
