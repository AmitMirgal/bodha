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
		workspaceState: Memento;
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
	export interface StatusBarItem extends Disposable {
		command: string | undefined;
		show(): void;
		text: string;
		tooltip: string | undefined;
	}
	export const StatusBarAlignment: {
		Left: number;
		Right: number;
	};
	export const commands: {
		registerCommand(
			id: string,
			callback: (...args: never[]) => unknown
		): Disposable;
	};
	export const window: {
		createStatusBarItem(alignment?: number, priority?: number): StatusBarItem;
		createWebviewPanel(
			viewType: string,
			title: string,
			column: number,
			options: { enableScripts: boolean }
		): WebviewPanel;
		showErrorMessage(message: string): Thenable<string | undefined>;
		showInformationMessage(
			message: string,
			...items: string[]
		): Thenable<string | undefined>;
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
	};
	export const env: {
		openExternal(target: { toString(): string }): Thenable<boolean>;
	};
	export interface WorkspaceConfiguration {
		get<T>(section: string): T | undefined;
	}
	export const workspace: {
		getConfiguration(section: string): WorkspaceConfiguration;
		onDidChangeWorkspaceFolders(listener: () => void): Disposable;
		workspaceFolders?: Array<{ uri: { fsPath: string } }>;
	};
	export const Uri: {
		parse(value: string): { toString(): string };
	};
}
