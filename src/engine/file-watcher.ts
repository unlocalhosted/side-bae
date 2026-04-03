import * as vscode from "vscode";
import { readdir } from "node:fs/promises";
import { join, basename } from "node:path";

const TOUR_DIR = ".side-bae";

export interface FileWatcherCallbacks {
  onNewTour: (tourId: string) => void;
  onNewFullLesson: (lessonId: string) => void;
  onSidebarRefresh: () => void;
}

export class SideBaeFileWatcher {
  private watcher: vscode.FileSystemWatcher | null = null;
  private knownFiles = new Set<string>();

  constructor(
    private workspaceRoot: string,
    private callbacks: FileWatcherCallbacks
  ) {}

  async start(): Promise<void> {
    // Snapshot existing files so we only react to genuinely new ones
    try {
      const entries = await readdir(join(this.workspaceRoot, TOUR_DIR));
      for (const e of entries) this.knownFiles.add(e);
    } catch {
      // Directory doesn't exist yet — that's fine
    }

    const pattern = new vscode.RelativePattern(
      join(this.workspaceRoot, TOUR_DIR),
      "*"
    );

    // Watch for creates, changes, and deletes — external tools may overwrite existing files
    this.watcher = vscode.workspace.createFileSystemWatcher(pattern, false, false, false);

    this.watcher.onDidCreate((uri) => {
      const filename = basename(uri.fsPath);
      this.knownFiles.add(filename);
      this.routeNewFile(filename);
    });

    this.watcher.onDidChange((uri) => {
      const filename = basename(uri.fsPath);
      this.routeNewFile(filename);
    });

    this.watcher.onDidDelete((uri) => {
      this.knownFiles.delete(basename(uri.fsPath));
      this.callbacks.onSidebarRefresh();
    });
  }

  private routeNewFile(filename: string): void {
    if (filename.endsWith(".full-lesson.json")) {
      const lessonId = filename.replace(".full-lesson.json", "");
      this.callbacks.onNewFullLesson(lessonId);
    } else if (filename.endsWith(".tour.json")) {
      const tourId = filename.replace(".tour.json", "");
      this.callbacks.onNewTour(tourId);
    } else if (
      filename === "features.json" ||
      filename === "learnable-concepts.json" ||
      filename === "whats-new.json"
    ) {
      this.callbacks.onSidebarRefresh();
    }
  }

  dispose(): void {
    this.watcher?.dispose();
    this.watcher = null;
  }
}
