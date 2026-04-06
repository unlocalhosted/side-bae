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
  /** Debounce timers per filename to avoid duplicate notifications (macOS fires create+change). */
  private debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

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
      const wasKnown = this.knownFiles.has(filename);
      this.knownFiles.add(filename);
      this.debouncedRoute(filename, !wasKnown);
    });

    this.watcher.onDidChange((uri) => {
      const filename = basename(uri.fsPath);
      this.debouncedRoute(filename, false);
    });

    this.watcher.onDidDelete((uri) => {
      this.knownFiles.delete(basename(uri.fsPath));
      this.callbacks.onSidebarRefresh();
    });
  }

  /** Debounce file routing to coalesce rapid create+change events (common on macOS). */
  private debouncedRoute(filename: string, isNew: boolean): void {
    const existing = this.debounceTimers.get(filename);
    if (existing) clearTimeout(existing);
    this.debounceTimers.set(
      filename,
      setTimeout(() => {
        this.debounceTimers.delete(filename);
        this.routeFile(filename, isNew);
      }, 300)
    );
  }

  private routeFile(filename: string, isNew: boolean): void {
    if (filename.endsWith(".full-lesson.json")) {
      const lessonId = filename.replace(".full-lesson.json", "");
      this.callbacks.onNewFullLesson(lessonId);
    } else if (filename.endsWith(".tour.json")) {
      const tourId = filename.replace(".tour.json", "");
      if (isNew) {
        this.callbacks.onNewTour(tourId);
      } else {
        // Tour was updated, not created — refresh sidebar without "New tour" prompt
        this.callbacks.onSidebarRefresh();
      }
    } else if (
      filename === "features.json" ||
      filename === "learnable-concepts.json" ||
      filename === "whats-new.json"
    ) {
      this.callbacks.onSidebarRefresh();
    }
  }

  dispose(): void {
    for (const timer of this.debounceTimers.values()) clearTimeout(timer);
    this.debounceTimers.clear();
    this.watcher?.dispose();
    this.watcher = null;
  }
}
