// @ts-check

(function () {
  // @ts-ignore
  const vscode = acquireVsCodeApi();

  /** @type {HTMLElement} */
  const root = document.getElementById("root");

  /** @type {HTMLCanvasElement} */
  const canvas = document.getElementById("confetti-canvas");
  const ctx = canvas.getContext("2d");

  let previousNodeId = null;
  let hasSeenAllNodes = false;

  const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
  const systemReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const generateShortcut = isMac ? "\u2318\u21E7T" : "Ctrl+Shift+T";
  const backHint = isMac ? "\u2325\u2190" : "Alt+\u2190";

  let celebrationsSetting = "auto";

  function shouldShowCelebrations() {
    if (celebrationsSetting === "on") return true;
    if (celebrationsSetting === "off") return false;
    return !systemReducedMotion;
  }

  // ── Confetti System ──────────────────────────────────────────────

  /** @type {Array<{x:number, y:number, vx:number, vy:number, w:number, h:number, color:string, rotation:number, rotationSpeed:number, opacity:number, decay:number}>} */
  let particles = [];
  let animationFrame = null;

  function resizeCanvas() {
    canvas.width = document.body.clientWidth;
    canvas.height = document.body.clientHeight;
  }

  function fireConfetti(style, count) {
    resizeCanvas();
    const accent = getComputedStyle(document.body).getPropertyValue("--vscode-textLink-foreground").trim() || "#4fc1ff";
    const fg = getComputedStyle(document.body).getPropertyValue("--vscode-foreground").trim() || "#cccccc";
    const palette = [accent, lighten(accent, 40), lighten(accent, 80), fg, lighten(fg, 60)];

    for (let i = 0; i < count; i++) {
      const color = palette[Math.floor(Math.random() * palette.length)];
      if (style === "burst") {
        const angle = (Math.random() * Math.PI) - Math.PI / 2;
        const speed = 2 + Math.random() * 4;
        particles.push({ x: canvas.width / 2 + (Math.random() - 0.5) * 40, y: 20 + Math.random() * 20, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 1, w: 3 + Math.random() * 4, h: 2 + Math.random() * 3, color, rotation: Math.random() * 360, rotationSpeed: (Math.random() - 0.5) * 12, opacity: 0.9 + Math.random() * 0.1, decay: 0.012 + Math.random() * 0.008 });
      } else if (style === "rain") {
        particles.push({ x: Math.random() * canvas.width, y: -10 - Math.random() * 30, vx: (Math.random() - 0.5) * 1.5, vy: 1.5 + Math.random() * 2.5, w: 3 + Math.random() * 5, h: 2 + Math.random() * 3, color, rotation: Math.random() * 360, rotationSpeed: (Math.random() - 0.5) * 10, opacity: 0.85 + Math.random() * 0.15, decay: 0.006 + Math.random() * 0.006 });
      } else if (style === "sparkle") {
        particles.push({ x: Math.random() * canvas.width, y: canvas.height * 0.5 + (Math.random() - 0.5) * 60, vx: (Math.random() - 0.5) * 1, vy: -0.5 - Math.random() * 1.5, w: 2 + Math.random() * 2, h: 2 + Math.random() * 2, color, rotation: Math.random() * 360, rotationSpeed: (Math.random() - 0.5) * 15, opacity: 0.7 + Math.random() * 0.3, decay: 0.02 + Math.random() * 0.015 });
      }
    }
    if (!animationFrame) animateConfetti();
  }

  function animateConfetti() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx; p.vy += 0.06; p.y += p.vy; p.rotation += p.rotationSpeed; p.opacity -= p.decay;
      if (p.opacity <= 0 || p.y > canvas.height + 20) { particles.splice(i, 1); continue; }
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate((p.rotation * Math.PI) / 180); ctx.globalAlpha = p.opacity; ctx.fillStyle = p.color; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); ctx.restore();
    }
    if (particles.length > 0) { animationFrame = requestAnimationFrame(animateConfetti); } else { animationFrame = null; ctx.clearRect(0, 0, canvas.width, canvas.height); }
  }

  function lighten(hex, amount) {
    try {
      hex = hex.replace("#", "");
      if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
      const num = parseInt(hex, 16);
      if (isNaN(num)) return "#ffffff";
      return `rgb(${Math.min(255, ((num >> 16) & 255) + amount)},${Math.min(255, ((num >> 8) & 255) + amount)},${Math.min(255, (num & 255) + amount)})`;
    } catch {
      return "#ffffff";
    }
  }

  // ── Rendering ────────────────────────────────────────────────────

  const lessonShortcut = isMac ? "\u2318\u21E7L" : "Ctrl+Shift+L";

  const atlasShortcut = isMac ? "\u2318\u21E7E" : "Ctrl+Shift+E";

  const hubActions = [
    {
      command: "sideBae.exploreAtlas",
      icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
      name: "Explore This Codebase",
      desc: "Architecture, layers, and how data flows",
      shortcut: atlasShortcut,
      primary: true,
    },
    {
      command: "sideBae.generateTour",
      icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>',
      name: "Ask About a Feature",
      desc: "\u201CHow does auth work?\u201D \u2192 AI-guided code tour",
      shortcut: generateShortcut,
    },
    {
      command: "sideBae.discoverFeatures",
      icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
      name: "Discover Features",
      desc: "Auto-scan and map this codebase",
      shortcut: null,
    },
    {
      command: "sideBae.investigateIssue",
      icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2v4"/><path d="M16 2v4"/><circle cx="9" cy="13" r="1"/><circle cx="15" cy="13" r="1"/><path d="M9 17c1 1 5 1 6 0"/><rect x="2" y="6" width="20" height="16" rx="4"/></svg>',
      name: "Investigate Issue",
      desc: "Paste a bug \u2192 root cause + fix",
      shortcut: null,
    },
    {
      command: "sideBae.startLesson",
      icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c0 2 6 3 6 3s6-1 6-3v-5"/></svg>',
      name: "Learn from This Code",
      desc: "Live AI tutor teaches patterns in this codebase",
      shortcut: lessonShortcut,
    },
    {
      command: "sideBae.whatsNew",
      icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
      name: "What\u2019s New",
      desc: "See recent git changes at a glance",
      shortcut: null,
    },
  ];

  function renderCommandHub() {
    root.innerHTML = `
      <div class="command-hub fade-in">
        <div class="hub-header">
          <div class="hub-title">Side Bae</div>
          <div class="hub-subtitle">Ask how something works. Get an interactive tour that traces real code, explains decisions, and connects the dots.</div>
        </div>
        <div class="hub-actions">
          ${hubActions.map((a, i) => `${i === 1 ? '<div class="hub-divider"></div>' : ""}
            <button class="hub-action${a.primary ? " hub-action-primary" : ""}" data-command="${a.command}" aria-label="${a.name} — ${a.desc}">
              <span class="hub-icon" aria-hidden="true">${a.icon}</span>
              <div class="hub-text">
                <div class="hub-name">${a.name}</div>
                <div class="hub-desc">${a.desc}</div>
              </div>
              ${a.shortcut ? `<kbd class="hub-shortcut" aria-label="Keyboard shortcut: ${a.shortcut}">${a.shortcut}</kbd>` : ""}
            </button>
          `).join("")}
        </div>
      </div>
    `;

    root.querySelectorAll(".hub-action").forEach(btn => {
      btn.addEventListener("click", () => {
        vscode.postMessage({ type: "launchCommand", command: btn.getAttribute("data-command") });
      });
    });
  }

  function renderMarkdown(text) {
    if (!text) return "";

    // 1. Extract code blocks BEFORE escaping (protect them)
    const codeBlocks = [];
    let processed = text.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
      const idx = codeBlocks.length;
      codeBlocks.push('<pre class="md-code-block"><code>' + escapeHtml(code) + "</code></pre>");
      return "\uFFFF CB_" + idx + "\uFFFE";
    });

    // 2. Extract inline code BEFORE escaping
    const inlineCode = [];
    processed = processed.replace(/`([^`]+)`/g, (_, code) => {
      const idx = inlineCode.length;
      // Detect file:line patterns inside backticks and make them clickable
      const fileMatch = code.match(/^([\w/.@-]+\.\w+):(\d+)(?:-(\d+))?$/);
      if (fileMatch) {
        const file = fileMatch[1];
        const line = fileMatch[2];
        inlineCode.push('<a class="file-link" data-file="' + escapeHtml(file) + '" data-line="' + line + '"><code class="md-inline-code">' + escapeHtml(code) + '</code></a>');
      } else {
        inlineCode.push('<code class="md-inline-code">' + escapeHtml(code) + "</code>");
      }
      return "\uFFFF IL_" + idx + "\uFFFE";
    });

    // 3. Escape remaining text (safe now — code is protected)
    let html = escapeHtml(processed);

    // 4. Apply markdown patterns
    html = html
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>");
    html = html.replace(/^### (.+)$/gm, '<h3 class="md-h3">$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2 class="md-h2">$1</h2>');
    html = html
      .replace(/^- (.+)$/gm, '<li class="md-list-item">$1</li>')
      .replace(/(<li class="md-list-item">.*?<\/li>\n?)+/g, '<ul class="md-list">$&</ul>')
      .replace(/\n\n/g, "<br/><br/>")
      .replace(/\n/g, "<br/>");

    // 5. Re-insert code blocks and inline code
    html = html.replace(/\uFFFF CB_(\d+)\uFFFE/g, (_, idx) => codeBlocks[parseInt(idx)] || "");
    html = html.replace(/\uFFFF IL_(\d+)\uFFFE/g, (_, idx) => inlineCode[parseInt(idx)] || "");

    return html;
  }

  /** Render the tour summary card (shown before the first stop) */
  function renderSummary(summary) {
    // Build a numbered list of stops from the graph (BFS order)
    let stopsHtml = "";
    if (summary.graph && summary.graph.nodes.length > 0) {
      const adj = {};
      for (const n of summary.graph.nodes) adj[n.id] = [];
      for (const e of summary.graph.edges) {
        if (adj[e.from]) adj[e.from].push(e.to);
      }

      // BFS to get traversal order
      const order = [];
      const seen = new Set();
      const queue = [summary.graph.entryId];
      seen.add(summary.graph.entryId);
      while (queue.length > 0) {
        const id = queue.shift();
        const node = summary.graph.nodes.find(n => n.id === id);
        if (node) order.push(node);
        for (const child of (adj[id] || [])) {
          if (!seen.has(child)) {
            seen.add(child);
            queue.push(child);
          }
        }
      }
      // Add orphans
      for (const n of summary.graph.nodes) {
        if (!seen.has(n.id)) order.push(n);
      }

      const maxPreview = 5;
      const previewNodes = order.slice(0, maxPreview);
      const remaining = order.length - maxPreview;

      stopsHtml = `
        <div class="summary-stops">
          <div class="summary-stops-label">What you'll explore</div>
          <ol class="summary-stop-list">
            ${previewNodes.map((n, i) => `
              <li class="summary-stop-item ${i === 0 ? "summary-stop-entry" : ""}" tabindex="0" role="button" aria-label="Stop ${i + 1}: ${escapeHtml(n.title)}" data-node-id="${escapeHtml(n.id)}">
                <span class="stop-number">${i + 1}</span>
                <span class="stop-title">${escapeHtml(n.title)}</span>
              </li>
            `).join("")}
            ${remaining > 0 ? `<li class="summary-stop-more">... and ${remaining} more stop${remaining === 1 ? "" : "s"}</li>` : ""}
          </ol>
        </div>
      `;
    }

    root.innerHTML = `
      <div class="panel-header">${escapeHtml(summary.name)}</div>
      <div class="card-scroll">
        <div class="summary-card fade-in">
          <div class="summary-meta">
            <div class="summary-query">"${escapeHtml(summary.query)}"</div>
            <div class="summary-stats-line">${summary.totalNodes} stops across ${summary.totalFiles} file${summary.totalFiles === 1 ? "" : "s"}</div>
          </div>
          ${stopsHtml}
        </div>
      </div>
      <div class="card-dock">
        <button class="summary-start-btn" id="btn-start-tour">
          Start tour
          <svg class="btn-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>
    `;

    document.getElementById("btn-start-tour").addEventListener("click", () => {
      vscode.postMessage({ type: "dismissSummary" });
    });

    // Stop item click/enter → jump directly to that stop
    root.querySelectorAll(".summary-stop-item").forEach((el) => {
      const jump = () => {
        vscode.postMessage({ type: "dismissSummary" });
        setTimeout(() => {
          vscode.postMessage({ type: "navigate", nodeId: el.getAttribute("data-node-id") });
        }, 50);
      };
      el.addEventListener("click", jump);
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); jump(); }
      });
    });
  }

  let currentReport = null;

  function renderCard(data) {
    const { node, breadcrumb, canGoBack, totalNodes, visitedCount, edgeInfo, arrivedVia, summary, isNewTour, report, annotations } = data;
    currentReport = report || null;

    // Show summary card on new tour instead of jumping straight to first stop
    if (isNewTour && summary) {
      renderSummary(summary);
      return;
    }

    const isLeafNode = node.edges.length === 0;
    const allVisited = visitedCount >= totalNodes;
    const justCompletedAll = allVisited && !hasSeenAllNodes;
    const nodeChanged = previousNodeId !== null && previousNodeId !== (breadcrumb[breadcrumb.length - 1]?.id);
    previousNodeId = breadcrumb[breadcrumb.length - 1]?.id ?? null;

    // Celebrations
    if (shouldShowCelebrations()) {
      if (justCompletedAll) {
        hasSeenAllNodes = true;
        setTimeout(() => fireConfetti("rain", 80), 100);
        setTimeout(() => fireConfetti("rain", 50), 600);
      } else if (isLeafNode && nodeChanged) {
        setTimeout(() => fireConfetti("sparkle", 20), 300);
      }
    } else if (justCompletedAll) {
      hasSeenAllNodes = true;
    }

    // ── Kind badge (investigation tours) ──
    const kindSvgs = {
      context: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>',
      problem: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
      solution: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14"/></svg>',
    };
    const kindLabels = { context: "The Setup", problem: "What\u2019s Wrong", solution: "The Fix" };
    const kindBadgeHtml = node.kind
      ? `<div class="kind-badge kind-${node.kind}${nodeChanged ? " badge-enter" : ""}">${kindSvgs[node.kind] || ""} ${kindLabels[node.kind] || node.kind}</div>`
      : "";
    const cardKindClass = node.kind === "problem" ? " has-problem" : node.kind === "solution" ? " has-solution" : "";

    // ── Suggested edit (diff block for solution nodes) ──
    let suggestedEditHtml = "";
    if (node.suggestedEdit) {
      let lineIdx = 0;
      const oldLines = escapeHtml(node.suggestedEdit.oldText).split("\n").map(l => `<span class="diff-line diff-remove${nodeChanged ? " diff-enter" : ""}" ${nodeChanged ? `style="animation-delay:${lineIdx++ * 40}ms"` : ""}>- ${l}</span>`).join("");
      const newLines = escapeHtml(node.suggestedEdit.newText).split("\n").map(l => `<span class="diff-line diff-add${nodeChanged ? " diff-enter" : ""}" ${nodeChanged ? `style="animation-delay:${lineIdx++ * 40}ms"` : ""}>+ ${l}</span>`).join("");
      suggestedEditHtml = `
        <div class="suggested-edit">
          <div class="edit-label">The Fix</div>
          <pre class="edit-diff">${oldLines}${newLines}</pre>
          <button class="apply-fix-btn">Apply fix</button>
        </div>
      `;
    }

    // ── Connective context (how you got here) ──
    const contextHtml = arrivedVia
      ? `<div class="arrived-via fade-in">${escapeHtml(arrivedVia)}</div>`
      : "";

    // ── Edges or completion ──
    let edgesHtml = "";
    if (isLeafNode) {
      const checkmark = allVisited
        ? `<svg class="checkmark-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path class="checkmark-path" d="M5 13l4 4L19 7"/></svg>`
        : "";
      const msg = allVisited
        ? "All explored \u2014 nice work."
        : "End of this branch. Use <strong>Back</strong> to try another path.";
      edgesHtml = `
        <div class="tour-complete fade-in ${allVisited ? "all-visited" : ""}">
          <div class="complete-line"></div>
          <div class="complete-message">${checkmark}<span>${msg}</span></div>
        </div>
      `;
    } else {
      const label = node.edges.length === 1 ? "Continues to" : "Where to next";
      edgesHtml = `
        <div class="card-edges">
          <div class="card-edges-label">${label}</div>
          ${node.edges.map((edge, i) => {
            const info = (edgeInfo || {})[edge.target] || { state: "new", reachableCount: 1 };
            const stateClass = info.state === "new" ? "" : `edge-${info.state}`;
            const icon = info.state === "complete" ? "&#x2713;" : info.state === "partial" ? "&#x25CB;" : "&rarr;";
            const badge = info.state === "complete" ? "done" : info.state === "partial" ? "in progress" : "";
            const depth = info.reachableCount > 1 ? `<span class="edge-depth">${info.reachableCount} stops</span>` : info.reachableCount === 1 ? `<span class="edge-depth">1 stop</span>` : "";
            return `
            <button class="edge-link ${stateClass} ${nodeChanged ? "edge-enter" : ""}" data-target="${escapeHtml(edge.target)}" aria-label="${escapeHtml(edge.label)}${badge ? ` (${badge})` : ""}${info.reachableCount ? `, ${info.reachableCount} stop${info.reachableCount === 1 ? "" : "s"}` : ""}" style="${nodeChanged ? `animation-delay: ${i * 60}ms` : ""}">
              <span class="arrow" aria-hidden="true">${icon}</span>
              <span class="edge-label">${escapeHtml(edge.label)}</span>
              <span class="edge-meta">${badge ? `<span class="visited-badge">${badge}</span>` : ""}${depth}</span>
            </button>`;
          }).join("")}
        </div>
      `;
    }

    // ── Breadcrumb (compact — just path, no progress bar) ──
    const progressText = `${visitedCount}/${totalNodes}`;
    const breadcrumbHtml = `
      <div class="breadcrumb">
        <span class="breadcrumb-progress ${allVisited ? "progress-glow" : ""}">${progressText}</span>
        ${breadcrumb.length > 1 ? breadcrumb.map((entry, i) => `
          ${i > 0 ? '<span class="breadcrumb-separator">&rsaquo;</span>' : '<span class="breadcrumb-separator">&mdash;</span>'}
          <button class="breadcrumb-item ${i === breadcrumb.length - 1 ? "current" : ""}" data-node-id="${escapeHtml(entry.id)}">${escapeHtml(entry.title)}</button>
        `).join("") : ""}
      </div>
    `;

    // ── Card: scroll zone + fixed dock ──
    root.innerHTML = `
      <div class="panel-header">${escapeHtml(data.tourName)}</div>
      <div class="card-scroll">
        <div class="tour-card ${nodeChanged ? "card-enter" : ""}${cardKindClass}">
          ${breadcrumbHtml}
          ${kindBadgeHtml}
          ${contextHtml}
          <div class="card-header">
            <div class="card-title">${escapeHtml(node.title)}</div>
            <div class="card-file" title="${escapeHtml(node.file)}:${node.startLine}-${node.endLine}">${escapeHtml(node.file)}:${node.startLine}-${node.endLine}</div>
          </div>
          <div class="card-explanation">${renderMarkdown(node.explanation)}</div>
          ${renderQnASection(breadcrumb[breadcrumb.length - 1]?.id ?? "", annotations?.[breadcrumb[breadcrumb.length - 1]?.id] || [], "tour")}
          ${suggestedEditHtml}
          ${currentReport && allVisited ? `
            <div class="investigation-report fade-in">
              <button class="report-toggle">
                <svg class="report-arrow" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                <svg class="report-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg>
                <span>Investigation Report</span>
              </button>
              <div class="report-content">
                <div class="report-body">${renderMarkdown(currentReport)}</div>
                <button class="copy-report-btn">Copy report</button>
              </div>
            </div>
          ` : ""}
        </div>
      </div>
      <div class="card-dock">
        ${edgesHtml}
        <div class="card-footer">
          <button class="nav-back-btn" id="btn-back" ${canGoBack ? "" : "disabled"}><span class="nav-key">${backHint}</span> Back</button>
          <button class="stop-btn" id="btn-stop"><span class="nav-key">Esc</span> Done</button>
        </div>
      </div>
    `;

    // Bind events
    root.querySelectorAll(".edge-link").forEach((btn) => {
      btn.addEventListener("click", () => vscode.postMessage({ type: "navigate", nodeId: btn.getAttribute("data-target") }));
    });
    root.querySelectorAll(".breadcrumb-item:not(.current)").forEach((btn) => {
      btn.addEventListener("click", () => vscode.postMessage({ type: "navigate", nodeId: btn.getAttribute("data-node-id") }));
    });
    const backBtn = document.getElementById("btn-back");
    if (backBtn) backBtn.addEventListener("click", () => vscode.postMessage({ type: "back" }));
    const stopBtn = document.getElementById("btn-stop");
    if (stopBtn) stopBtn.addEventListener("click", () => vscode.postMessage({ type: "stop" }));

    // Q&A section events + selection listener
    const currentNodeId = breadcrumb[breadcrumb.length - 1]?.id ?? "";
    bindQnAEvents(currentNodeId, "tour");
    attachSelectionListener(".card-explanation", ".card-scroll", currentNodeId, "tour");

    // Apply fix button
    const applyBtn = root.querySelector(".apply-fix-btn");
    if (applyBtn && node.suggestedEdit) {
      applyBtn.addEventListener("click", () => {
        applyBtn.textContent = "Applied \u2713";
        applyBtn.disabled = true;
        applyBtn.classList.add("applied");
        vscode.postMessage({
          type: "applyFix",
          nodeId: breadcrumb[breadcrumb.length - 1]?.id ?? "",
          oldText: node.suggestedEdit.oldText,
          newText: node.suggestedEdit.newText,
        });
      });
    }

    // Report toggle (collapsible)
    const reportToggle = root.querySelector(".report-toggle");
    if (reportToggle) {
      const reportContent = root.querySelector(".report-content");
      reportToggle.addEventListener("click", () => {
        const expanded = reportContent.classList.toggle("expanded");
        reportToggle.classList.toggle("expanded", expanded);
      });
    }

    // Copy Report button
    const copyBtn = root.querySelector(".copy-report-btn");
    if (copyBtn && currentReport) {
      copyBtn.addEventListener("click", () => {
        const original = copyBtn.textContent;
        copyBtn.textContent = "Copied!";
        copyBtn.classList.add("copied");
        setTimeout(() => {
          copyBtn.textContent = original;
          copyBtn.classList.remove("copied");
        }, 1500);
        vscode.postMessage({
          type: "copyReport",
          report: currentReport,
        });
      });
    }
  }

  // ── Lesson Stepper Rendering ──────────────────────────────

  let lessonState = null;
  let expandedCompletedStep = -1;
  let lastScrolledStepIndex = -1;

  function renderLessonPlanLoading() {
    root.innerHTML = `
      <div class="panel-header">Generating lesson plan...</div>
      <div class="card-scroll">
        <div class="lesson-loading fade-in">
          <div class="lesson-loading-dots">
            <div class="lesson-loading-dot"></div>
            <div class="lesson-loading-dot"></div>
            <div class="lesson-loading-dot"></div>
          </div>
          <div class="lesson-loading-text" id="lesson-loading-msg"></div>
        </div>
      </div>
    `;
  }

  function updateLessonLoadingMessage(message) {
    // Try plan-level loading first, then step-level loading
    const el = document.getElementById("lesson-loading-msg") || document.getElementById("step-loading-msg");
    if (el) el.textContent = message;
  }

  function renderLessonStepper(state) {
    lessonState = state;
    const letters = "ABCDEFGH";

    const stepsHtml = state.steps.map((step, i) => {
      const isActive = step.status === "active";
      const isCompleted = step.status === "completed";
      const isSkipped = step.status === "skipped";
      const isExpanded = isActive || (isCompleted && expandedCompletedStep === i);

      // Icon
      const iconContent = isCompleted ? "\u2713" : isSkipped ? "\u2013" : isActive ? "" : "";

      // Header
      const headerHtml = `
        <div class="stepper-header" data-step-index="${i}">
          <div class="stepper-title">${i + 1}. ${escapeHtml(step.plan.title)}</div>
          ${step.summary && !isExpanded ? `<div class="stepper-summary">${escapeHtml(step.summary)}</div>` : ""}
          ${isActive && step.plan.file ? `<div class="stepper-file" title="${escapeHtml(step.plan.file)}:${step.plan.startLine}-${step.plan.endLine}">${escapeHtml(step.plan.file)}:${step.plan.startLine}-${step.plan.endLine}</div>` : ""}
        </div>
      `;

      // Content (only if expanded)
      let contentHtml = "";
      if (isExpanded && step.content) {
        const explanationHtml = step.content.explanation
          ? `<div class="lesson-content">${renderMarkdown(step.content.explanation)}</div>`
          : "";

        const promptHtml = step.content.prompt
          ? `<div class="lesson-prompt">${renderMarkdown(step.content.prompt)}</div>`
          : "";

        // Q&A exchange (if user has answered)
        let exchangeHtml = "";
        if (step.response) {
          const answerText = step.userChoiceIndex !== undefined && step.content.options
            ? step.content.options[step.userChoiceIndex] ?? ""
            : step.userAnswer ?? "";
          const responseClass = step.response.correct === true ? " correct" : step.response.correct === false ? " incorrect" : "";
          exchangeHtml = `
            <div class="stepper-exchange">
              <div class="stepper-user-answer">You: "${escapeHtml(answerText)}"</div>
              <div class="stepper-ai-response${responseClass}">${renderMarkdown(step.response.content)}</div>
            </div>
          `;
        }

        // Input area (only on active step, only if no response yet)
        let inputHtml = "";
        if (isActive && !step.response && step.content.prompt) {
          if (step.content.inputType === "text") {
            inputHtml = `
              <div class="lesson-input-area">
                <label for="lesson-input" class="sr-only">Your answer</label>
                <textarea class="lesson-textarea" id="lesson-input" placeholder="What do you think? (${isMac ? "\u2318" : "Ctrl"}+Enter to send)" rows="3"></textarea>
                <div class="lesson-input-actions">
                  <button class="lesson-send-btn" id="lesson-send">Send</button>
                </div>
              </div>
            `;
          } else if (step.content.inputType === "choice" && step.content.options) {
            inputHtml = `
              <div class="lesson-choices">
                ${step.content.options.map((opt, ci) => `
                  <button class="lesson-choice-btn" data-index="${ci}" aria-label="Option ${letters[ci] || ci + 1}: ${escapeHtml(opt)}">
                    <span class="choice-letter" aria-hidden="true">${letters[ci] || ci + 1}</span>
                    <span class="choice-text">${escapeHtml(opt)}</span>
                  </button>
                `).join("")}
              </div>
            `;
          }
        }

        // Continue button: show when response exists OR when there's no input method
        const noInputMethod = !step.content.prompt || step.content.inputType === "none";
        const continueHtml = isActive && (step.response || noInputMethod)
          ? `<button class="lesson-send-btn" id="lesson-continue" style="width:100%">Continue</button>`
          : "";

        // Q&A section for the lesson step
        const stepQnAHtml = renderQnASection(step.plan.id, [], "lesson");

        contentHtml = `
          <div class="stepper-content">
            ${explanationHtml}
            ${stepQnAHtml}
            ${promptHtml}
            ${exchangeHtml}
            ${inputHtml}
            ${continueHtml}
          </div>
        `;
      }

      // Skip reason
      if (isSkipped && step.summary) {
        contentHtml = `<div class="stepper-skip-reason">${escapeHtml(step.summary)}</div>`;
      }

      // Active step loading (no content yet)
      if (isActive && !step.content) {
        contentHtml = `
          <div class="stepper-content">
            <div class="step-loading">
              <div class="lesson-loading-dots" role="status" aria-label="Loading"><div class="lesson-loading-dot"></div><div class="lesson-loading-dot"></div><div class="lesson-loading-dot"></div></div>
              <span id="step-loading-msg"></span>
            </div>
          </div>
        `;
      }

      return `
        <div class="stepper-step ${step.status}" data-index="${i}">
          <div class="stepper-icon">${iconContent}</div>
          ${headerHtml}
          ${contentHtml}
        </div>
      `;
    }).join("");

    const recapHtml = state.isComplete && state.recapData ? renderRecapCard(state.recapData) : "";

    root.innerHTML = `
      <div class="panel-header">Learning: ${escapeHtml(state.subject)}</div>
      <div class="card-scroll">
        <div class="lesson-stepper fade-in">
          ${stepsHtml}
        </div>
        ${recapHtml}
      </div>
      <div class="card-dock">
        <button class="lesson-end-btn" id="lesson-end" style="width:100%">Done</button>
      </div>
    `;

    bindStepperEvents(state);

    // Scroll: when complete, scroll to recap; otherwise scroll to active step
    if (state.isComplete && state.recapData) {
      const recapEl = root.querySelector(".lesson-recap");
      if (recapEl) {
        requestAnimationFrame(() => recapEl.scrollIntoView({ behavior: systemReducedMotion ? "auto" : "smooth", block: "start" }));
      }
    } else {
      const activeIdx = state.activeStepIndex;
      if (activeIdx !== lastScrolledStepIndex) {
        lastScrolledStepIndex = activeIdx;
        const activeStep = root.querySelector(".stepper-step.active");
        if (activeStep) {
          requestAnimationFrame(() => activeStep.scrollIntoView({ behavior: systemReducedMotion ? "auto" : "smooth", block: "nearest" }));
        }
      }
    }
  }

  function renderRecapCard(recap) {
    // Concepts section
    let conceptsHtml = "";
    if (recap.concepts.length > 0) {
      const conceptItems = recap.concepts.map((c) => {
        const iconClass = c.solid ? "solid" : "shaky";
        const icon = c.solid ? "\u2713" : "?";
        return `
          <div class="recap-concept">
            <span class="recap-concept-icon ${iconClass}">${icon}</span>
            <span class="recap-concept-name">${escapeHtml(c.name)}</span>
          </div>
        `;
      }).join("");

      conceptsHtml = `
        <div class="recap-section">
          <div class="recap-section-title">Concepts</div>
          ${conceptItems}
        </div>
      `;
    }

    // Predictions section — show up to 5 most interesting moments
    let predictionsHtml = "";
    const preds = recap.predictions.slice(0, 5);
    if (preds.length > 0) {
      const predItems = preds.map((p) => `
        <div class="recap-prediction">
          <div class="recap-prediction-label">${escapeHtml(p.stepTitle)}</div>
          <div class="recap-prediction-text">You said: "${escapeHtml(p.userSaid.length > 120 ? p.userSaid.slice(0, 120) + "..." : p.userSaid)}"</div>
          <div class="recap-reality-text">${renderMarkdown(p.aiFeedback.length > 200 ? p.aiFeedback.slice(0, 200) + "..." : p.aiFeedback)}</div>
        </div>
      `).join("");

      predictionsHtml = `
        <div class="recap-section">
          <div class="recap-section-title">Your journey</div>
          ${predItems}
        </div>
      `;
    }

    // Score
    const scoreHtml = recap.score.total > 0
      ? `<div class="recap-score">${recap.score.solid} of ${recap.score.total} concepts solid</div>`
      : "";

    return `
      <div class="lesson-recap card-enter">
        <div class="recap-section-title" style="font-size:13px; margin-bottom:4px;">Lesson complete</div>
        ${scoreHtml}
        ${conceptsHtml}
        ${predictionsHtml}
      </div>
    `;
  }

  function bindStepperEvents(state) {
    // Q&A events for active lesson step
    const activeStep = state.steps[state.activeStepIndex];
    if (activeStep?.plan?.id) {
      bindQnAEvents(activeStep.plan.id, "lesson");
      attachSelectionListener(".lesson-content", ".card-scroll", activeStep.plan.id, "lesson");
    }

    // Text send
    const sendBtn = document.getElementById("lesson-send");
    const textarea = document.getElementById("lesson-input");
    if (sendBtn && textarea) {
      const send = () => {
        const text = textarea.value.trim();
        if (!text) return;
        vscode.postMessage({ type: "lessonAnswer", text });
      };
      sendBtn.addEventListener("click", send);
      textarea.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send(); }
      });
      setTimeout(() => textarea.focus(), 100);
    }

    // Choice buttons
    root.querySelectorAll(".lesson-choice-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const index = parseInt(btn.getAttribute("data-index"), 10);
        const step = state.steps[state.activeStepIndex];
        const correctIdx = step?.content?.correctIndex;

        // Show feedback
        root.querySelectorAll(".lesson-choice-btn").forEach((b, ci) => {
          if (ci === index && correctIdx !== undefined && ci !== correctIdx) b.classList.add("choice-wrong");
          else if (correctIdx !== undefined && ci === correctIdx) b.classList.add("choice-correct");
          else b.classList.add("choice-disabled");
        });

        setTimeout(() => {
          vscode.postMessage({ type: "lessonChoice", choiceIndex: index });
        }, 600);
      });
    });

    // Continue
    const continueBtn = document.getElementById("lesson-continue");
    if (continueBtn) {
      continueBtn.addEventListener("click", () => {
        vscode.postMessage({ type: "lessonContinue" });
      });
    }

    // Click completed step headers to expand/collapse
    root.querySelectorAll(".stepper-step.completed .stepper-header").forEach((header) => {
      header.addEventListener("click", () => {
        const idx = parseInt(header.getAttribute("data-step-index"), 10);
        expandedCompletedStep = expandedCompletedStep === idx ? -1 : idx;
        renderLessonStepper(lessonState);
      });
    });

    // End
    const endBtn = document.getElementById("lesson-end");
    if (endBtn) {
      endBtn.addEventListener("click", () => {
        vscode.postMessage({ type: "lessonEnd" });
      });
    }
  }

  // ── Investigation Rendering ──────────────────────────────────

  function renderInvestigationLoading(initialMessage) {
    root.innerHTML = `
      <div class="panel-header">Investigating...</div>
      <div class="card-scroll">
        <div class="lesson-loading fade-in">
          <div class="lesson-loading-dots">
            <div class="lesson-loading-dot"></div>
            <div class="lesson-loading-dot"></div>
            <div class="lesson-loading-dot"></div>
          </div>
          <div class="lesson-loading-text" id="investigation-loading-msg">${initialMessage ? escapeHtml(initialMessage) : ""}</div>
        </div>
      </div>
    `;
  }

  function updateInvestigationLoadingMessage(message) {
    const el = document.getElementById("investigation-loading-msg");
    if (el) el.textContent = message;
  }

  function renderInvestigationTrail(trail) {
    if (!trail || trail.length === 0) return "";
    const display = trail.length > 15 ? trail.slice(-15) : trail;
    return `
      <div class="investigation-trail">
        ${display.map((entry, i) => `
          <div class="trail-entry" style="animation-delay: ${i * 60}ms">
            <span class="trail-dot trail-${escapeHtml(entry.kind || "context")}"></span>
            <span class="trail-file">${escapeHtml(shortFileName(entry.file))}</span>
          </div>
          ${i < display.length - 1 ? '<span class="trail-separator">\u203A</span>' : ""}
        `).join("")}
      </div>
    `;
  }

  function shortFileName(path) {
    if (!path) return "";
    const parts = path.replace(/\\/g, "/").split("/");
    return parts.length > 1 ? parts.slice(-1)[0] : path;
  }

  function renderInvestigationStep(step, state) {
    const borderClass = step.phase === "diagnose" ? " has-diagnose"
      : step.phase === "propose" || step.phase === "revise" ? " has-propose"
      : "";

    const trailHtml = renderInvestigationTrail(step.trail);

    const fileRef = step.file ? `${step.file}${step.startLine ? `:${step.startLine}-${step.endLine}` : ""}` : "";
    const fileHtml = step.file
      ? `<div class="card-file" title="${escapeHtml(fileRef)}">${escapeHtml(fileRef)}</div>`
      : "";

    const contentHtml = step.content
      ? `<div class="investigation-content">${renderMarkdown(step.content)}</div>`
      : "";

    const promptHtml = step.prompt
      ? `<div class="lesson-prompt">${renderMarkdown(step.prompt)}</div>`
      : "";

    // Suggested edit diff
    let diffHtml = "";
    if (step.suggestedEdit) {
      const oldLines = escapeHtml(step.suggestedEdit.oldText).split("\n").map(l => `<span class="diff-line diff-remove">- ${l}</span>`).join("");
      const newLines = escapeHtml(step.suggestedEdit.newText).split("\n").map(l => `<span class="diff-line diff-add">+ ${l}</span>`).join("");
      diffHtml = `
        <div class="suggested-edit">
          <div class="edit-label">The Fix</div>
          <pre class="edit-diff">${oldLines}${newLines}</pre>
        </div>
      `;
    }

    // Test results
    let testHtml = "";
    if (step.testResults) {
      const passed = step.testResults.failed === 0;
      const summaryText = passed
        ? `All ${step.testResults.passed} tests passed`
        : `${step.testResults.failed} test${step.testResults.failed === 1 ? "" : "s"} failed`;
      testHtml = `
        <div class="test-results ${passed ? "tests-passed" : "tests-failed"}">
          <div class="test-results-summary">${passed ? "\u2713" : "\u2717"} ${summaryText}</div>
          ${(step.testResults.errors ?? []).length > 0 ? `<pre class="test-results-errors">${escapeHtml((step.testResults.errors ?? []).slice(0, 5).join("\n").slice(0, 2000))}</pre>` : ""}
        </div>
      `;
    }

    // PR card
    let prHtml = "";
    if (step.prUrl) {
      prHtml = `
        <div class="pr-card">
          <div class="pr-card-header">\u2713 Pull request opened</div>
          ${step.title ? `<div class="pr-card-title">${escapeHtml(step.title)}</div>` : ""}
          <div class="pr-card-meta">
            ${step.branchName ? `<span>main \u2190 ${escapeHtml(step.branchName)}</span>` : ""}
            ${step.additions !== undefined ? `<span>+${step.additions} / -${step.deletions || 0} across ${step.filesChanged || 0} file${(step.filesChanged || 0) === 1 ? "" : "s"}</span>` : ""}
          </div>
          <button class="pr-card-link" data-url="${escapeHtml(step.prUrl)}">View on GitHub \u2192</button>
        </div>
      `;
      // Fire celebration confetti for PR creation
      if (shouldShowCelebrations()) {
        setTimeout(() => fireConfetti("rain", 80), 200);
        setTimeout(() => fireConfetti("rain", 50), 700);
      }
    }

    // Input area
    let inputHtml = "";
    if (step.awaitsResponse) {
      if (step.inputType === "text") {
        inputHtml = `
          <div class="lesson-input-area">
            <textarea class="lesson-textarea" id="investigation-input" placeholder="Redirect or ask a question..." rows="2"></textarea>
            <div class="lesson-input-actions">
              <button class="lesson-send-btn" id="investigation-send">Send</button>
              <button class="investigation-confirm-btn" id="investigation-confirm">\u2713 On the right track</button>
            </div>
          </div>
        `;
      } else if (step.inputType === "confirm") {
        inputHtml = `
          <div class="lesson-input-area">
            <textarea class="lesson-textarea" id="investigation-input" placeholder="Redirect or ask a question..." rows="2"></textarea>
            <div class="lesson-input-actions">
              <button class="investigation-confirm-btn" id="investigation-confirm">\u2713 On the right track</button>
              <button class="lesson-send-btn" id="investigation-send">Send feedback</button>
            </div>
          </div>
        `;
      }
    }

    // Phase-specific action buttons
    let actionsHtml = "";
    if (!step.awaitsResponse && !step.isComplete) {
      const actions = [];
      if (step.phase === "diagnose" || (step.phase === "investigate" && !state.fixApplied)) {
        actions.push(`<button class="investigation-action-btn" id="investigation-request-fix">Show me a fix</button>`);
      }
      if (step.suggestedEdit && !state.fixApplied) {
        actions.push(`<button class="investigation-action-btn" id="investigation-apply-fix">Apply fix</button>`);
        actions.push(`<button class="investigation-action-btn secondary" id="investigation-feedback">I have feedback</button>`);
      }
      if (state.fixApplied && !state.testsRun) {
        actions.push(`<button class="investigation-action-btn" id="investigation-run-tests">Run tests</button>`);
      }
      if (state.testsRun && step.testResults && step.testResults.failed === 0 && !state.prCreated) {
        actions.push(`<button class="investigation-action-btn" id="investigation-create-pr">Open pull request</button>`);
      }
      if (actions.length > 0) {
        actionsHtml = `<div class="investigation-actions">${actions.join("")}</div>`;
      }
    }

    root.innerHTML = `
      <div class="panel-header">Investigating: ${escapeHtml(state.issueTitle)}</div>
      <div class="card-scroll">
        <div class="investigation-step card-enter${borderClass}">
          ${trailHtml}
          ${step.title ? `<div class="card-header"><div class="card-title">${escapeHtml(step.title)}</div>${fileHtml}</div>` : fileHtml ? `<div class="card-header">${fileHtml}</div>` : ""}
          ${contentHtml}
          ${renderQnASection(state.stepIndex?.toString() || "inv-" + (state.turnCount || 0), [], "investigation")}
          ${promptHtml}
          ${diffHtml}
          ${testHtml}
          ${prHtml}
          ${inputHtml}
          ${actionsHtml}
        </div>
      </div>
      <div class="card-dock">
        <div class="investigation-footer">
          <div class="lesson-followup" style="flex:1">
            <input class="lesson-followup-input" id="investigation-followup" placeholder="Redirect or ask a question..." />
            <button class="lesson-followup-send" id="investigation-followup-send">Ask</button>
          </div>
          <button class="lesson-end-btn" id="investigation-end">Done</button>
        </div>
      </div>
    `;

    bindInvestigationEvents(step, state);
  }

  function bindInvestigationEvents(_step, _state) {
    // Q&A events for investigation step
    const invNodeId = _state.stepIndex?.toString() || "inv-" + (_state.turnCount || 0);
    bindQnAEvents(invNodeId, "investigation");
    attachSelectionListener(".investigation-content", ".card-scroll", invNodeId, "investigation");

    // Text send
    const sendBtn = document.getElementById("investigation-send");
    const textarea = document.getElementById("investigation-input");
    if (sendBtn && textarea) {
      const send = () => {
        const text = textarea.value.trim();
        if (!text) return;
        vscode.postMessage({ type: "investigationResponse", text });
        renderInvestigationLoading();
      };
      sendBtn.addEventListener("click", send);
      textarea.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send(); }
      });
      setTimeout(() => textarea.focus(), 100);
    }

    // Confirm
    const confirmBtn = document.getElementById("investigation-confirm");
    if (confirmBtn) {
      confirmBtn.addEventListener("click", () => {
        vscode.postMessage({ type: "investigationConfirm" });
        renderInvestigationLoading();
      });
    }

    // Action buttons
    const requestFixBtn = document.getElementById("investigation-request-fix");
    if (requestFixBtn) {
      requestFixBtn.addEventListener("click", () => {
        vscode.postMessage({ type: "investigationRequestFix" });
        renderInvestigationLoading();
      });
    }

    const applyFixBtn = document.getElementById("investigation-apply-fix");
    if (applyFixBtn) {
      applyFixBtn.addEventListener("click", () => {
        vscode.postMessage({ type: "investigationApplyFix" });
        renderInvestigationLoading();
      });
    }

    const feedbackBtn = document.getElementById("investigation-feedback");
    if (feedbackBtn && textarea) {
      feedbackBtn.addEventListener("click", () => {
        // Switch to text input mode
        textarea.focus();
        textarea.placeholder = "What would you change about this fix?";
      });
    }

    const runTestsBtn = document.getElementById("investigation-run-tests");
    if (runTestsBtn) {
      runTestsBtn.addEventListener("click", () => {
        vscode.postMessage({ type: "investigationRunTests" });
        renderInvestigationLoading();
      });
    }

    const createPrBtn = document.getElementById("investigation-create-pr");
    if (createPrBtn) {
      createPrBtn.addEventListener("click", () => {
        vscode.postMessage({ type: "investigationCreatePR" });
        renderInvestigationLoading();
      });
    }

    // PR link
    const prLink = root.querySelector(".pr-card-link");
    if (prLink) {
      prLink.addEventListener("click", () => {
        const url = prLink.getAttribute("data-url");
        if (url) vscode.postMessage({ type: "openExternal", url });
      });
    }

    // Follow-up
    const followupInput = document.getElementById("investigation-followup");
    const followupSend = document.getElementById("investigation-followup-send");
    if (followupInput && followupSend) {
      const ask = () => {
        const text = followupInput.value.trim();
        if (!text) return;
        vscode.postMessage({ type: "investigationResponse", text });
        renderInvestigationLoading();
      };
      followupSend.addEventListener("click", ask);
      followupInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") { e.preventDefault(); ask(); }
      });
    }

    // End
    const endBtn = document.getElementById("investigation-end");
    if (endBtn) {
      endBtn.addEventListener("click", () => {
        vscode.postMessage({ type: "investigationEnd" });
      });
    }
  }

  // ══════════════════════════════════════════════════════════
  // SYSTEM ATLAS — Codebase Map + Flow Traces
  // ══════════════════════════════════════════════════════════

  let atlasData = null;

  function renderAtlasPhase1(data) {
    atlasData = data;
    root.innerHTML = `
      <div class="panel-header">${escapeHtml(data.projectName)}</div>
      <div class="card-scroll">
        <div class="atlas">
          <div class="atlas-identity">
            <div class="atlas-project-name">${escapeHtml(data.projectName)}</div>
            <div class="atlas-summary">${renderMarkdown(data.summary)}</div>
            <div class="atlas-tech-stack">
              ${(data.techStack || []).map(t => `<span class="atlas-tech-badge">${escapeHtml(t)}</span>`).join("")}
            </div>
          </div>
          <div id="atlas-phase2"></div>
          <div id="atlas-phase3"></div>
          <div id="atlas-phase4"></div>
        </div>
      </div>
      <div class="card-dock">
        <div class="atlas-loading">
          <div class="lesson-loading-dots"><div class="lesson-loading-dot"></div><div class="lesson-loading-dot"></div><div class="lesson-loading-dot"></div></div>
          <span class="lesson-loading-text" id="atlas-loading-msg">Scanning architecture...</span>
        </div>
      </div>
    `;
  }

  function renderAtlasPhase2(data) {
    atlasData = { ...atlasData, ...data };
    const target = document.getElementById("atlas-phase2");
    if (!target) return;

    // Build layers with connections between them
    const connectionsBySource = new Map();
    for (const conn of (data.connections || [])) {
      if (!connectionsBySource.has(conn.from)) connectionsBySource.set(conn.from, []);
      connectionsBySource.get(conn.from).push(conn);
    }

    let html = `<div class="atlas-layers"><div class="atlas-section-label">Architecture</div>`;

    for (let i = 0; i < (data.layers || []).length; i++) {
      const layer = data.layers[i];
      html += `
        <div class="atlas-layer" data-layer-id="${escapeHtml(layer.id)}" tabindex="0" role="button" aria-expanded="false">
          <div class="atlas-layer-header">
            <div class="atlas-layer-name">${escapeHtml(layer.name)}</div>
          </div>
          <div class="atlas-layer-desc">${escapeHtml(layer.description)}</div>
          <div class="atlas-layer-files">
            ${(layer.keyFiles || []).map(f => `<span class="atlas-layer-file" data-file="${escapeHtml(f)}" tabindex="0" role="link">${escapeHtml(f)}</span>`).join("")}
          </div>
        </div>
      `;

      // Show connections from this layer to the next
      const conns = connectionsBySource.get(layer.id) || [];
      for (const conn of conns) {
        html += `
          <div class="atlas-connection">
            <span class="atlas-connection-arrow">\u2193</span>
            ${escapeHtml(conn.label)}
          </div>
        `;
      }
    }

    html += `</div>`;
    target.innerHTML = html;

    // Bind layer expand/collapse
    target.querySelectorAll(".atlas-layer").forEach(el => {
      const toggle = (e) => {
        if (e.target.classList?.contains("atlas-layer-file")) return;
        const expanded = el.classList.toggle("expanded");
        el.setAttribute("aria-expanded", expanded ? "true" : "false");
      };
      el.addEventListener("click", toggle);
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(e); }
      });
    });

    // Bind file clicks
    target.querySelectorAll(".atlas-layer-file").forEach(el => {
      const open = (e) => {
        e.stopPropagation(); // don't bubble to layer toggle
        const file = el.getAttribute("data-file");
        if (file) vscode.postMessage({ type: "openFileAtLine", file, line: 1 });
      };
      el.addEventListener("click", open);
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter") { e.preventDefault(); open(e); }
      });
    });

    // Update loading message
    const msg = document.getElementById("atlas-loading-msg");
    if (msg) msg.textContent = "Tracing flows...";
  }

  function renderAtlasPhase3(data) {
    atlasData = { ...atlasData, ...data };
    const target = document.getElementById("atlas-phase3");
    if (!target) return;

    let html = `<div class="atlas-flows"><div class="atlas-section-label">Key Flows</div>`;

    for (const flow of (data.flows || [])) {
      const stepsHtml = (flow.steps || []).map((step, i) => `
        <div class="atlas-step" data-step-index="${i}" data-flow-id="${escapeHtml(flow.id)}">
          <button class="atlas-step-row" aria-expanded="false">
            <span class="atlas-step-num">${i + 1}</span>
            <span class="atlas-step-summary">${escapeHtml(step.summary)}</span>
            <span class="atlas-step-file">${escapeHtml(shortFileName(step.file))}</span>
          </button>
          <div class="atlas-step-detail">
            <div class="atlas-step-explanation">${renderMarkdown(step.explanation)}</div>
            <button class="atlas-step-deeper" data-query="${escapeHtml("How does " + step.summary.toLowerCase() + " work in " + step.file + "?")}">Go deeper \u2192</button>
          </div>
        </div>
      `).join("");

      html += `
        <div class="atlas-flow" data-flow-id="${escapeHtml(flow.id)}">
          <button class="atlas-flow-header" aria-expanded="false">
            <span class="atlas-flow-arrow">\u25B8</span>
            <span class="atlas-flow-name">${escapeHtml(flow.name)}</span>
            <span class="atlas-flow-trigger">${escapeHtml(flow.trigger)}</span>
          </button>
          <div class="atlas-flow-steps">${stepsHtml}</div>
        </div>
      `;
    }

    html += `</div>`;
    target.innerHTML = html;

    // Bind flow accordion
    target.querySelectorAll(".atlas-flow-header").forEach(header => {
      header.addEventListener("click", () => {
        const flow = header.closest(".atlas-flow");
        const wasExpanded = flow.classList.contains("expanded");
        // Collapse all flows
        target.querySelectorAll(".atlas-flow.expanded").forEach(f => f.classList.remove("expanded"));
        if (!wasExpanded) flow.classList.add("expanded");
      });
    });

    // Bind step expand (click step row → expand detail + open file)
    target.querySelectorAll(".atlas-step-row").forEach(row => {
      row.addEventListener("click", () => {
        const step = row.closest(".atlas-step");
        const wasExpanded = step.classList.contains("expanded");

        // Collapse all steps in this flow
        step.closest(".atlas-flow-steps")?.querySelectorAll(".atlas-step.expanded").forEach(s => s.classList.remove("expanded"));

        if (!wasExpanded) {
          step.classList.add("expanded");
          // Open file in editor
          const flowId = step.getAttribute("data-flow-id");
          const stepIdx = parseInt(step.getAttribute("data-step-index"), 10);
          const flowData = (atlasData?.flows || []).find(f => f.id === flowId);
          const stepData = flowData?.steps?.[stepIdx];
          if (stepData?.file) {
            vscode.postMessage({ type: "openFileAtLine", file: stepData.file, line: stepData.startLine || 1 });
          }
        }
      });
    });

    // Bind "Go deeper" buttons
    target.querySelectorAll(".atlas-step-deeper").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const query = btn.getAttribute("data-query");
        if (query) vscode.postMessage({ type: "atlasDeepDive", query });
      });
    });

    // Remove loading, show suggestions placeholder
    const dock = root.querySelector(".card-dock");
    if (dock) dock.innerHTML = `<button class="stop-btn" id="atlas-done"><span class="nav-key">Esc</span> Done</button>`;
    const doneBtn = document.getElementById("atlas-done");
    if (doneBtn) doneBtn.addEventListener("click", () => vscode.postMessage({ type: "stop" }));

    // Scroll to flows
    const flowsEl = target.querySelector(".atlas-flows");
    if (flowsEl) {
      requestAnimationFrame(() => flowsEl.scrollIntoView({ behavior: systemReducedMotion ? "auto" : "smooth", block: "nearest" }));
    }
  }

  function renderAtlasPhase4(data) {
    atlasData = { ...atlasData, ...data };
    const target = document.getElementById("atlas-phase4");
    if (!target) return;

    const suggestions = data.suggestions || [];
    if (suggestions.length === 0) return;

    const icons = { tour: "\u{1F9ED}", lesson: "\u{1F393}" };

    let html = `<div class="atlas-suggestions"><div class="atlas-section-label">Where to go next</div>`;
    for (const sug of suggestions) {
      html += `
        <button class="atlas-suggestion" data-type="${escapeHtml(sug.type)}" data-query="${escapeHtml(sug.query)}">
          <span class="atlas-suggestion-icon">${icons[sug.type] || "\u2192"}</span>
          <span class="atlas-suggestion-label">${escapeHtml(sug.label)}</span>
        </button>
      `;
    }
    html += `</div>`;
    target.innerHTML = html;

    // Bind suggestion clicks
    target.querySelectorAll(".atlas-suggestion").forEach(btn => {
      btn.addEventListener("click", () => {
        const type = btn.getAttribute("data-type");
        const query = btn.getAttribute("data-query");
        if (type === "tour") {
          vscode.postMessage({ type: "atlasDeepDive", query });
        } else if (type === "lesson") {
          vscode.postMessage({ type: "launchCommand", command: "sideBae.startLesson" });
        }
      });
    });
  }

  /** Render a complete cached atlas (all phases at once). */
  function renderAtlasFull(data) {
    renderAtlasPhase1(data);
    renderAtlasPhase2(data);
    renderAtlasPhase3(data);
    renderAtlasPhase4(data);
  }

  function updateAtlasLoadingMessage(message) {
    const el = document.getElementById("atlas-loading-msg");
    if (el) el.textContent = message;
  }

  // ══════════════════════════════════════════════════════════
  // ASK ABOUT SELECTION — Shared Q&A Module
  // ══════════════════════════════════════════════════════════

  /** @type {Map<string, Array<{selectedText: string, question: string, answer: string}>>} */
  const sessionQnA = new Map();

  /** @type {HTMLElement|null} */
  let activePill = null;

  /** @type {string|null} */
  let pillSelectedText = null;

  /** @type {boolean} */
  let hasAIProvider = true;

  // ── Single persistent listeners (avoid leak on re-render) ──
  let _qnaContainerSelector = null;
  let _qnaNodeId = null;
  let _qnaMode = null;

  // Selection listener — attached once at module load
  document.addEventListener("selectionchange", () => {
    if (!_qnaContainerSelector) return;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) { dismissPill(); return; }

    const text = sel.toString().trim();
    if (text.length < 3 || !/\w/.test(text)) { dismissPill(); return; }

    const range = sel.getRangeAt(0);
    const startEl = range.startContainer.nodeType === 1
      ? range.startContainer
      : range.startContainer.parentElement;
    const endEl = range.endContainer.nodeType === 1
      ? range.endContainer
      : range.endContainer.parentElement;
    // Both ends must be inside the explanation container
    if (!startEl || !startEl.closest(_qnaContainerSelector)) { dismissPill(); return; }
    if (!endEl || !endEl.closest(_qnaContainerSelector)) { dismissPill(); return; }

    pillSelectedText = text;
    const scrollEl = document.querySelector(".card-scroll");
    if (scrollEl) showPill(range, scrollEl);
  });

  // Scroll listener — attached once, dismisses pill on any .card-scroll scroll
  let _scrollListenerBound = false;
  function ensureScrollListener() {
    if (_scrollListenerBound) return;
    document.addEventListener("scroll", (e) => {
      if (e.target && /** @type {Element} */ (e.target).classList?.contains("card-scroll")) dismissPill();
    }, { capture: true, passive: true });
    _scrollListenerBound = true;
  }

  /**
   * Update the selection listener state for the current card/step.
   * Does NOT add new event listeners — the single persistent listener reads these.
   */
  function attachSelectionListener(containerSelector, _scrollSelector, nodeId, mode) {
    _qnaContainerSelector = containerSelector;
    _qnaNodeId = nodeId;
    _qnaMode = mode;
    ensureScrollListener();
  }

  function showPill(range, scrollEl) {
    dismissPill();
    const rect = range.getBoundingClientRect();
    const scrollRect = scrollEl.getBoundingClientRect();

    const pill = document.createElement("button");
    pill.className = "ask-pill";
    pill.textContent = "Ask";
    pill.setAttribute("aria-label", "Ask about selected text");

    const pillTop = rect.top - scrollRect.top + scrollEl.scrollTop - 28;
    const pillLeft = Math.max(4, Math.min(
      rect.left - scrollRect.left + rect.width / 2 - 20,
      scrollEl.clientWidth - 52  // pill width ~48px + 4px padding
    ));
    pill.style.top = pillTop + "px";
    pill.style.left = pillLeft + "px";

    pill.addEventListener("click", (e) => {
      e.preventDefault();
      // Capture position and text before clearing selection & dismissing
      const capturedText = pillSelectedText;
      const pillTopPos = parseFloat(pill.style.top) || pillTop;
      window.getSelection()?.removeAllRanges();
      dismissPill();
      onPillClick(scrollEl, pillTopPos, capturedText);
    });

    scrollEl.style.position = "relative";
    scrollEl.appendChild(pill);
    activePill = pill;
  }

  function dismissPill() {
    if (activePill) {
      activePill.classList.add("dismissing");
      const ref = activePill;
      setTimeout(() => ref.remove(), 100);
      activePill = null;
    }
    pillSelectedText = null;
  }

  /** @type {HTMLElement|null} */
  let activeInlineInput = null;

  function onPillClick(scrollEl, pillTopPos, capturedText) {
    if (!scrollEl || !capturedText) return;
    // Show inline input at the same vertical position where the pill was
    showInlineInput(scrollEl, pillTopPos, capturedText);
  }

  function showInlineInput(scrollEl, top, selectedText) {
    dismissInlineInput();

    const container = document.createElement("div");
    container.className = "ask-inline";
    container.style.top = Math.max(0, top) + "px";

    const truncated = selectedText.length > 80 ? selectedText.slice(0, 80) + "..." : selectedText;

    const input = document.createElement("textarea");
    input.className = "ask-inline-input";
    input.placeholder = "Ask about this selection...";
    input.rows = 1;
    input.value = `What is ${truncated}?`;

    const sendBtn = document.createElement("button");
    sendBtn.className = "ask-inline-send";
    sendBtn.textContent = "Ask";

    const dismissBtn = document.createElement("button");
    dismissBtn.className = "ask-inline-dismiss";
    dismissBtn.textContent = "\u00D7";
    dismissBtn.setAttribute("aria-label", "Dismiss");

    container.appendChild(input);
    container.appendChild(sendBtn);
    container.appendChild(dismissBtn);

    scrollEl.style.position = "relative";
    scrollEl.appendChild(container);
    activeInlineInput = container;

    // Focus and select the pre-filled text so the user can easily replace it
    requestAnimationFrame(() => {
      input.focus();
      input.select();
    });

    // Submit handler — sends the question, dismisses inline, and shows answer at bottom
    const submit = () => {
      const question = input.value.trim();
      if (!question) return;
      dismissInlineInput();
      submitInlineQuestion(question, selectedText);
    };

    sendBtn.addEventListener("click", submit);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
      if (e.key === "Escape") dismissInlineInput();
    });
    dismissBtn.addEventListener("click", () => dismissInlineInput());
  }

  function dismissInlineInput() {
    if (activeInlineInput) {
      activeInlineInput.classList.add("dismissing");
      const ref = activeInlineInput;
      setTimeout(() => ref.remove(), 100);
      activeInlineInput = null;
    }
  }

  /** Submit from inline input: expand the bottom QnA section & post the message */
  function submitInlineQuestion(question, selectedText) {
    const nodeId = _qnaNodeId;
    const mode = _qnaMode;
    if (!nodeId || !mode) return;

    // Expand the bottom QnA section so the user sees the answer appear there
    const toggle = document.querySelector(".qna-toggle");
    const body = document.querySelector(".qna-body");
    if (toggle && body && !body.classList.contains("expanded")) {
      toggle.classList.add("expanded");
      body.classList.add("expanded");
      toggle.setAttribute("aria-expanded", "true");
    }

    // Disable the bottom input while the inline question is in-flight
    const bottomInput = document.getElementById("qna-input");
    const bottomSend = document.getElementById("qna-send");
    if (bottomInput) bottomInput.disabled = true;
    if (bottomSend) bottomSend.disabled = true;

    // Add loading indicator to the QnA list
    const list = ensureQnAList();
    const loadingItem = document.createElement("div");
    loadingItem.className = "qna-item qna-item-loading";
    loadingItem.innerHTML = `
      <div class="qna-question" style="cursor:default">
        <span class="qna-question-icon">\u25B8</span>
        <span class="qna-question-text">${escapeHtml(question)}</span>
      </div>
      <div class="qna-loading">
        <div class="lesson-loading-dots"><div class="lesson-loading-dot"></div><div class="lesson-loading-dot"></div><div class="lesson-loading-dot"></div></div>
        <span>Looking at the code...</span>
      </div>
    `;
    list.appendChild(loadingItem);
    list.scrollTop = list.scrollHeight;

    // Scroll the QnA section into view
    const qnaSection = document.querySelector(".stop-qna");
    if (qnaSection) {
      qnaSection.scrollIntoView({ behavior: systemReducedMotion ? "auto" : "smooth", block: "nearest" });
    }

    // Store selectedText for the response handler
    pillSelectedText = selectedText;

    // Post message to extension
    vscode.postMessage({
      type: "askFollowUp",
      nodeId,
      selectedText: selectedText || "",
      question,
      mode,
    });
  }

  // ── Shared helpers ──

  /** Accordion toggle — collapse all, expand clicked if not already open. */
  function toggleQnAItem(btn) {
    const answer = btn.nextElementSibling;
    const wasExpanded = answer.classList.contains("expanded");
    document.querySelectorAll(".qna-answer.expanded").forEach(a => a.classList.remove("expanded"));
    document.querySelectorAll(".qna-question[aria-expanded='true']").forEach(q => q.setAttribute("aria-expanded", "false"));
    if (!wasExpanded) {
      answer.classList.add("expanded");
      btn.setAttribute("aria-expanded", "true");
    }
  }

  /** Ensure the .qna-list element exists, creating it if needed. */
  function ensureQnAList() {
    let list = document.querySelector(".qna-list");
    if (!list) {
      list = document.createElement("div");
      list.className = "qna-list";
      const bodyEl = document.querySelector(".qna-body");
      if (bodyEl) bodyEl.insertBefore(list, bodyEl.querySelector(".qna-input-row") || bodyEl.querySelector(".qna-no-provider"));
    }
    return list;
  }

  /** Re-enable Q&A input after response or error. */
  function reenableQnAInput() {
    const input = document.getElementById("qna-input");
    const sendBtn = document.getElementById("qna-send");
    if (input) { input.disabled = false; input.focus(); }
    if (sendBtn) sendBtn.disabled = false;
  }

  // ── Render & Bind ──

  function renderQnASection(nodeId, annotations, mode) {
    const sessionItems = sessionQnA.get(nodeId) || [];
    const allItems = [...(annotations || []), ...sessionItems];

    const count = allItems.length;
    if (count === 0 && !hasAIProvider) return "";

    const itemsHtml = allItems.map((item, i) => `
      <div class="qna-item" data-qna-index="${i}">
        <button class="qna-question" aria-expanded="false" aria-controls="qna-answer-${i}">
          <span class="qna-question-icon">\u25B8</span>
          <span class="qna-question-text">${escapeHtml(item.question)}</span>
        </button>
        <div class="qna-answer" id="qna-answer-${i}">${renderMarkdown(item.answer)}</div>
      </div>
    `).join("");

    const inputHtml = hasAIProvider
      ? `<div class="qna-input-row">
          <textarea class="qna-input" id="qna-input" placeholder="What does this mean?" rows="1"></textarea>
          <button class="qna-send" id="qna-send">Ask</button>
        </div>`
      : `<div class="qna-no-provider">Set up Claude Code or GitHub Copilot in settings to ask questions about this code.</div>`;

    const toggleLabel = count > 0 ? `${count} question${count === 1 ? "" : "s"}` : "Ask a question";

    return `
      <div class="stop-qna" data-node-id="${escapeHtml(nodeId)}" data-mode="${mode}">
        <button class="qna-toggle" aria-expanded="false">
          <span class="qna-toggle-arrow">\u25B8</span>
          ${escapeHtml(toggleLabel)}
        </button>
        <div class="qna-body">
          ${count > 0 ? `<div class="qna-list">${itemsHtml}</div>` : ""}
          ${inputHtml}
        </div>
      </div>
    `;
  }

  function bindQnAEvents(nodeId, mode) {
    const toggle = document.querySelector(".qna-toggle");
    const body = document.querySelector(".qna-body");
    if (toggle && body) {
      toggle.addEventListener("click", () => {
        const expanded = body.classList.toggle("expanded");
        toggle.classList.toggle("expanded", expanded);
        toggle.setAttribute("aria-expanded", expanded ? "true" : "false");
      });
    }

    document.querySelectorAll(".qna-question").forEach((btn) => {
      btn.addEventListener("click", () => toggleQnAItem(btn));
    });

    const sendBtn = document.getElementById("qna-send");
    const input = document.getElementById("qna-input");
    if (sendBtn && input) {
      let sending = false;
      const send = () => {
        const question = input.value.trim();
        if (!question || sending) return;
        sending = true;
        input.value = "";
        input.disabled = true;
        sendBtn.disabled = true;

        const list = ensureQnAList();
        const loadingItem = document.createElement("div");
        loadingItem.className = "qna-item qna-item-loading";
        loadingItem.innerHTML = `
          <div class="qna-question" style="cursor:default">
            <span class="qna-question-icon">\u25B8</span>
            <span class="qna-question-text">${escapeHtml(question)}</span>
          </div>
          <div class="qna-loading">
            <div class="lesson-loading-dots"><div class="lesson-loading-dot"></div><div class="lesson-loading-dot"></div><div class="lesson-loading-dot"></div></div>
            <span>Looking at the code...</span>
          </div>
        `;
        list.appendChild(loadingItem);
        list.scrollTop = list.scrollHeight;

        vscode.postMessage({
          type: "askFollowUp",
          nodeId,
          selectedText: pillSelectedText || "",
          question,
          mode,
        });
      };
      sendBtn.addEventListener("click", send);
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
      });
    }
  }

  function handleAskFollowUpResponse(nodeId, annotation, mode) {
    if (mode !== "tour") {
      if (!sessionQnA.has(nodeId)) sessionQnA.set(nodeId, []);
      sessionQnA.get(nodeId).push(annotation);
    }

    const loadingItem = document.querySelector(".qna-item-loading");
    if (loadingItem) loadingItem.remove();

    const list = ensureQnAList();
    const index = list.querySelectorAll(".qna-item").length;
    const item = document.createElement("div");
    item.className = "qna-item";
    item.setAttribute("data-qna-index", String(index));
    item.innerHTML = `
      <button class="qna-question" aria-expanded="true" aria-controls="qna-answer-${index}">
        <span class="qna-question-icon">\u25B8</span>
        <span class="qna-question-text">${escapeHtml(annotation.question)}</span>
      </button>
      <div class="qna-answer expanded" id="qna-answer-${index}">${renderMarkdown(annotation.answer)}</div>
    `;
    list.appendChild(item);
    list.scrollTop = list.scrollHeight;

    item.querySelector(".qna-question").addEventListener("click", function () { toggleQnAItem(this); });

    reenableQnAInput();

    const toggle = document.querySelector(".qna-toggle");
    if (toggle) {
      const total = list.querySelectorAll(".qna-item").length;
      toggle.innerHTML = `<span class="qna-toggle-arrow">\u25B8</span> ${total} question${total === 1 ? "" : "s"}`;
    }
  }

  /** Handle error from the extension host — clean up loading state. */
  function handleAskFollowUpError() {
    const loadingItem = document.querySelector(".qna-item-loading");
    if (loadingItem) loadingItem.remove();
    reenableQnAInput();
  }

  function clearSessionQnA() {
    sessionQnA.clear();
    _qnaContainerSelector = null;
    _qnaNodeId = null;
    _qnaMode = null;
    dismissInlineInput();
  }

  function escapeHtml(text) {
    if (text == null) return "";
    const div = document.createElement("div");
    div.textContent = String(text);
    return div.innerHTML;
  }

  window.addEventListener("message", (event) => {
    const message = event.data;
    switch (message.type) {
      case "update":
        renderCard(message.data);
        break;
      case "lessonPlan":
        renderLessonStepper(message.state);
        break;
      case "lessonStepContent":
        if (lessonState) {
          lessonState.steps[message.stepIndex].content = message.content;
          renderLessonStepper(lessonState);
        }
        break;
      case "lessonStepResponse":
        if (lessonState) {
          lessonState.steps[message.stepIndex].response = message.response;
          lessonState.steps[message.stepIndex].summary = message.response.summary;
          renderLessonStepper(lessonState);
        }
        break;
      case "lessonStepSkipped":
        if (lessonState) {
          lessonState.steps[message.stepIndex].status = "skipped";
          lessonState.steps[message.stepIndex].summary = message.reason;
          renderLessonStepper(lessonState);
        }
        break;
      case "lessonStepLoading":
        if (message.stepIndex === -1) {
          renderLessonPlanLoading();
        } else if (lessonState) {
          renderLessonStepper(lessonState);
        }
        break;
      case "lessonLoadingMessage":
        updateLessonLoadingMessage(message.message);
        break;
      case "investigationUpdate":
        renderInvestigationStep(message.step, message.state);
        break;
      case "investigationLoading":
        renderInvestigationLoading(message.message);
        break;
      case "investigationLoadingMessage":
        updateInvestigationLoadingMessage(message.message);
        break;
      case "atlasPhase1":
        renderAtlasPhase1(message.data);
        break;
      case "atlasPhase2":
        renderAtlasPhase2(message.data);
        break;
      case "atlasPhase3":
        renderAtlasPhase3(message.data);
        break;
      case "atlasPhase4":
        renderAtlasPhase4(message.data);
        break;
      case "atlasFull":
        renderAtlasFull(message.data);
        break;
      case "atlasLoadingMessage":
        updateAtlasLoadingMessage(message.message);
        break;
      case "askFollowUpResponse":
        handleAskFollowUpResponse(message.nodeId, message.annotation, message.mode);
        break;
      case "askFollowUpError":
        handleAskFollowUpError();
        break;
      case "providerStatus":
        hasAIProvider = !!message.available;
        break;
      case "config":
        celebrationsSetting = message.celebrations || "auto";
        canvas.style.display = shouldShowCelebrations() ? "" : "none";
        break;
      case "clear":
        previousNodeId = null;
        hasSeenAllNodes = false;
        currentReport = null;
        atlasData = null;
        clearSessionQnA();
        particles = [];
        if (animationFrame) { cancelAnimationFrame(animationFrame); animationFrame = null; }
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        renderCommandHub();
        break;
    }
  });

  window.addEventListener("resize", resizeCanvas);

  // Global delegated handler for clickable file:line links
  document.addEventListener("click", (e) => {
    const link = e.target.closest(".file-link");
    if (link) {
      e.preventDefault();
      const file = link.getAttribute("data-file");
      const line = parseInt(link.getAttribute("data-line") || "1", 10);
      if (file) {
        vscode.postMessage({ type: "openFileAtLine", file, line });
      }
    }
  });

  renderCommandHub();

  // Signal to the extension that the webview is ready to receive messages
  vscode.postMessage({ type: "ready" });
})();
