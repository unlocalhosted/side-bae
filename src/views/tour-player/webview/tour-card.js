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
    hex = hex.replace("#", "");
    if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    const num = parseInt(hex, 16);
    return `rgb(${Math.min(255, ((num >> 16) & 255) + amount)},${Math.min(255, ((num >> 8) & 255) + amount)},${Math.min(255, (num & 255) + amount)})`;
  }

  // ── Rendering ────────────────────────────────────────────────────

  const lessonShortcut = isMac ? "\u2318\u21E7L" : "Ctrl+Shift+L";

  const hubActions = [
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
          <div class="hub-subtitle">Pick a way to explore this codebase</div>
        </div>
        <div class="hub-actions">
          ${hubActions.map(a => `
            <button class="hub-action" data-command="${a.command}">
              <span class="hub-icon">${a.icon}</span>
              <div class="hub-text">
                <div class="hub-name">${a.name}</div>
                <div class="hub-desc">${a.desc}</div>
              </div>
              ${a.shortcut ? `<kbd class="hub-shortcut">${a.shortcut}</kbd>` : ""}
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

  function renderMarkdown(text, opts) {
    if (!text) return "";
    let html = escapeHtml(text)
      .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre class="md-code-block"><code>$2</code></pre>')
      .replace(/`([^`]+)`/g, '<code class="md-inline-code">$1</code>')
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>");
    if (opts && opts.headings) html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>");
    return html
      .replace(/^- (.+)$/gm, '<li class="md-list-item">$1</li>')
      .replace(/(<li class="md-list-item">.*?<\/li>\n?)+/g, '<ul class="md-list">$&</ul>')
      .replace(/\n\n/g, "<br/><br/>")
      .replace(/\n/g, "<br/>");
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
              <li class="summary-stop-item ${i === 0 ? "summary-stop-entry" : ""}" data-node-id="${escapeHtml(n.id)}">
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
          Begin walkthrough
          <svg class="btn-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>
    `;

    document.getElementById("btn-start-tour").addEventListener("click", () => {
      vscode.postMessage({ type: "dismissSummary" });
    });

    // Stop item click → jump directly to that stop
    root.querySelectorAll(".summary-stop-item").forEach((el) => {
      el.addEventListener("click", () => {
        vscode.postMessage({ type: "dismissSummary" });
        setTimeout(() => {
          vscode.postMessage({ type: "navigate", nodeId: el.getAttribute("data-node-id") });
        }, 50);
      });
    });
  }

  let currentReport = null;

  function renderCard(data) {
    const { node, breadcrumb, canGoBack, totalNodes, visitedCount, edgeInfo, arrivedVia, summary, isNewTour, report } = data;
    currentReport = report || null;

    // Show summary card on new tour instead of jumping straight to first stop
    if (isNewTour && summary) {
      if (shouldShowCelebrations()) {
        setTimeout(() => fireConfetti("burst", 45), 200);
      }
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
            <button class="edge-link ${stateClass} ${nodeChanged ? "edge-enter" : ""}" data-target="${escapeHtml(edge.target)}" style="${nodeChanged ? `animation-delay: ${i * 60}ms` : ""}">
              <span class="arrow">${icon}</span>
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
          ${suggestedEditHtml}
          ${currentReport && allVisited ? `
            <div class="investigation-report fade-in">
              <button class="report-toggle">
                <svg class="report-arrow" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                <svg class="report-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg>
                <span>Investigation Report</span>
              </button>
              <div class="report-content">
                <div class="report-body">${renderMarkdown(currentReport, { headings: true })}</div>
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

  // ── Lesson Rendering ──────────────────────────────────────

  function renderLessonLoading() {
    root.innerHTML = `
      <div class="panel-header">Learning...</div>
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
    const el = document.getElementById("lesson-loading-msg");
    if (el) el.textContent = message;
  }

  function renderLessonStep(step, state) {



    const phaseLabels = {
      prime: "",
      teach: "",
      check: "",
      respond: "",
      transition: "",
      recap: "What you learned",
    };

    if (step.isComplete && step.recapData) {
      renderLessonRecap(step, state);
      return;
    }

    // Layer badge
    const layerLabels = { outcome: "What it does", architecture: "How it\u2019s built", rationale: "Why this way", insight: "The clever bit", challenge: "Your turn" };
    const layerHtml = step.layer
      ? `<div class="layer-badge layer-${step.layer} badge-enter">${layerLabels[step.layer] || step.layer}</div>`
      : "";

    // Phase badge for prime/check
    const phaseLabel = phaseLabels[step.phase];
    const phaseBadgeHtml = phaseLabel
      ? `<div class="phase-badge phase-${step.phase}">${escapeHtml(phaseLabel)}</div>`
      : "";

    // Concept tags
    const conceptsHtml = step.concepts && step.concepts.length > 0
      ? `<div class="concept-tags">${step.concepts.map(c => `<span class="concept-tag">${escapeHtml(c)}</span>`).join("")}</div>`
      : "";

    // File reference
    const fileRef = step.file ? `${step.file}${step.startLine ? `:${step.startLine}-${step.endLine}` : ""}` : "";
    const fileHtml = step.file
      ? `<div class="card-file" title="${escapeHtml(fileRef)}">${escapeHtml(fileRef)}</div>`
      : "";

    // Main content
    const contentHtml = step.content
      ? `<div class="lesson-content">${renderMarkdown(step.content)}</div>`
      : "";

    // Prompt question
    const promptHtml = step.prompt
      ? `<div class="lesson-prompt">${renderMarkdown(step.prompt)}</div>`
      : "";

    // Input area (text or choice)
    let inputHtml = "";
    if (step.awaitsResponse) {
      if (step.inputType === "text") {
        inputHtml = `
          <div class="lesson-input-area">
            <textarea class="lesson-textarea" id="lesson-input" placeholder="What do you think? (${isMac ? "\u2318" : "Ctrl"}+Enter to send)" rows="3"></textarea>
            <div class="lesson-input-actions">
              <button class="lesson-send-btn" id="lesson-send">Send</button>
              ${step.skippable ? '<button class="lesson-skip-link" id="lesson-skip">Skip</button>' : ""}
            </div>
          </div>
        `;
      } else if (step.inputType === "choice" && step.options) {
        const letters = "ABCDEFGH";
        inputHtml = `
          <div class="lesson-choices">
            ${step.options.map((opt, i) => `
              <button class="lesson-choice-btn" data-index="${i}">
                <span class="choice-letter">${letters[i] || i + 1}</span>
                <span class="choice-text">${escapeHtml(opt)}</span>
              </button>
            `).join("")}
          </div>
          ${step.skippable ? '<button class="lesson-skip-link" id="lesson-skip">Skip</button>' : ""}
        `;
      }
    }

    // Step counter
    const counterHtml = `<span class="lesson-step-counter">${state.stepCount}</span>`;

    root.innerHTML = `
      <div class="panel-header">Learning: ${escapeHtml(state.subject)}</div>
      <div class="card-scroll">
        <div class="lesson-step card-enter">
          ${layerHtml}
          ${phaseBadgeHtml}
          ${conceptsHtml}
          ${step.title ? `<div class="card-header"><div class="card-title">${escapeHtml(step.title)}</div>${fileHtml}</div>` : fileHtml ? `<div class="card-header">${fileHtml}</div>` : ""}
          ${contentHtml}
          ${promptHtml}
          ${inputHtml}
        </div>
      </div>
      <div class="card-dock">
        ${!step.awaitsResponse ? `
          <button class="lesson-send-btn" id="lesson-continue" style="width:100%">Continue</button>
        ` : ""}
        <div class="lesson-footer">
          ${counterHtml}
          <div style="flex:1"></div>
          <div class="lesson-followup">
            <input class="lesson-followup-input" id="lesson-followup" placeholder="Ask a question..." />
            <button class="lesson-followup-send" id="lesson-followup-send">Ask</button>
          </div>
          <button class="lesson-end-btn" id="lesson-end">Done</button>
        </div>
      </div>
    `;

    // Bind events
    bindLessonEvents(step);
  }

  function bindLessonEvents(step) {
    // Text input send
    const sendBtn = document.getElementById("lesson-send");
    const textarea = document.getElementById("lesson-input");
    if (sendBtn && textarea) {
      const send = () => {
        const text = textarea.value.trim();
        if (!text) return;
        vscode.postMessage({ type: "lessonResponse", text });
        renderLessonLoading();
      };
      sendBtn.addEventListener("click", send);
      textarea.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          send();
        }
      });
      // Auto-focus textarea
      setTimeout(() => textarea.focus(), 100);
    }

    // Choice buttons
    root.querySelectorAll(".lesson-choice-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const index = parseInt(btn.getAttribute("data-index"), 10);
        // Show feedback before sending
        const correctIdx = step.correctIndex;
        root.querySelectorAll(".lesson-choice-btn").forEach((b, i) => {
          if (i === index && correctIdx !== undefined && i !== correctIdx) {
            b.classList.add("choice-wrong");
          } else if (correctIdx !== undefined && i === correctIdx) {
            b.classList.add("choice-correct");
          } else {
            b.classList.add("choice-disabled");
          }
        });
        // Send after brief pause to show feedback
        setTimeout(() => {
          vscode.postMessage({ type: "lessonChoice", choiceIndex: index });
          renderLessonLoading();
        }, 800);
      });
    });

    // Skip
    const skipBtn = document.getElementById("lesson-skip");
    if (skipBtn) {
      skipBtn.addEventListener("click", () => {
        vscode.postMessage({ type: "lessonSkip" });
        renderLessonLoading();
      });
    }

    // Continue (for non-interactive steps — distinct from skip)
    const continueBtn = document.getElementById("lesson-continue");
    if (continueBtn) {
      continueBtn.addEventListener("click", () => {
        vscode.postMessage({ type: "lessonContinue" });
        renderLessonLoading();
      });
    }

    // Follow-up question
    const followupInput = document.getElementById("lesson-followup");
    const followupSend = document.getElementById("lesson-followup-send");
    if (followupInput && followupSend) {
      const askFollowUp = () => {
        const text = followupInput.value.trim();
        if (!text) return;
        vscode.postMessage({ type: "lessonFollowUp", text });
        renderLessonLoading();
      };
      followupSend.addEventListener("click", askFollowUp);
      followupInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") { e.preventDefault(); askFollowUp(); }
      });
    }

    // Done
    const endBtn = document.getElementById("lesson-end");
    if (endBtn) {
      endBtn.addEventListener("click", () => {
        vscode.postMessage({ type: "lessonEnd" });
      });
    }
  }

  function renderLessonRecap(step, state) {
    const recap = step.recapData;
    if (!recap) return;

    const solidHtml = recap.conceptsSolid.map(c => `
      <div class="recap-concept">
        <span class="recap-concept-icon solid">\u2713</span>
        <span class="recap-concept-name">${escapeHtml(c)}</span>
      </div>
    `).join("");

    const shakyHtml = recap.conceptsShaky.map(c => `
      <div class="recap-concept">
        <span class="recap-concept-icon shaky">\u21BB</span>
        <div>
          <span class="recap-concept-name">${escapeHtml(c.name)}</span>
          <div class="recap-concept-note">${escapeHtml(c.suggestion)}</div>
        </div>
      </div>
    `).join("");

    const predictionsHtml = recap.predictionsVsReality.map(p => `
      <div class="recap-prediction">
        <div class="recap-prediction-label">You predicted</div>
        <div class="recap-prediction-text">"${escapeHtml(p.prediction)}"</div>
        <div class="recap-prediction-label" style="margin-top:4px">What actually happened</div>
        <div class="recap-reality-text">${escapeHtml(p.reality)}</div>
      </div>
    `).join("");

    const scoreHtml = recap.checksTotal > 0
      ? `<div class="recap-score">You nailed ${recap.checksCorrect} out of ${recap.checksTotal}</div>`
      : "";

    // Fire celebration
    if (shouldShowCelebrations()) {
      setTimeout(() => fireConfetti("rain", 80), 200);
      setTimeout(() => fireConfetti("rain", 50), 700);
    }

    root.innerHTML = `
      <div class="panel-header">Learning: ${escapeHtml(state.subject)}</div>
      <div class="card-scroll">
        <div class="lesson-recap fade-in">
          <div class="card-title" style="font-size:16px">What You Learned</div>
          ${step.content ? `<div class="lesson-content">${renderMarkdown(step.content)}</div>` : ""}
          ${scoreHtml}
          ${solidHtml || shakyHtml ? `
            <div class="recap-section">
              <div class="recap-section-title">What clicked</div>
              ${solidHtml}
              ${shakyHtml}
            </div>
          ` : ""}
          ${predictionsHtml ? `
            <div class="recap-section">
              <div class="recap-section-title">How your thinking evolved</div>
              ${predictionsHtml}
            </div>
          ` : ""}
        </div>
      </div>
      <div class="card-dock">
        <button class="lesson-end-btn" id="lesson-end" style="width:100%">Done</button>
      </div>
    `;

    const endBtn = document.getElementById("lesson-end");
    if (endBtn) {
      endBtn.addEventListener("click", () => {
        vscode.postMessage({ type: "lessonEnd" });
      });
    }
  }

  // ── Investigation Rendering ──────────────────────────────────

  function renderInvestigationLoading() {
    root.innerHTML = `
      <div class="panel-header">Investigating...</div>
      <div class="card-scroll">
        <div class="lesson-loading fade-in">
          <div class="lesson-loading-dots">
            <div class="lesson-loading-dot"></div>
            <div class="lesson-loading-dot"></div>
            <div class="lesson-loading-dot"></div>
          </div>
          <div class="lesson-loading-text" id="investigation-loading-msg"></div>
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
    trail = display;
    return `
      <div class="investigation-trail">
        ${trail.map((entry, i) => `
          <div class="trail-entry" style="animation-delay: ${i * 60}ms">
            <span class="trail-dot trail-${entry.kind}"></span>
            <span class="trail-file">${escapeHtml(shortFileName(entry.file))}</span>
          </div>
          ${i < trail.length - 1 ? '<span class="trail-separator">\u203A</span>' : ""}
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
          ${step.testResults.errors.length > 0 ? `<pre class="test-results-errors">${escapeHtml(step.testResults.errors.slice(0, 5).join("\n").slice(0, 2000))}</pre>` : ""}
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
      case "lessonUpdate":
        renderLessonStep(message.step, message.state);
        break;
      case "lessonLoading":
        renderLessonLoading();
        break;
      case "lessonLoadingMessage":
        updateLessonLoadingMessage(message.message);
        break;
      case "investigationUpdate":
        renderInvestigationStep(message.step, message.state);
        break;
      case "investigationLoading":
        renderInvestigationLoading();
        break;
      case "investigationLoadingMessage":
        updateInvestigationLoadingMessage(message.message);
        break;
      case "config":
        celebrationsSetting = message.celebrations || "auto";
        canvas.style.display = shouldShowCelebrations() ? "" : "none";
        break;
      case "clear":
        previousNodeId = null;
        hasSeenAllNodes = false;
        currentReport = null;
    
    
        particles = [];
        if (animationFrame) { cancelAnimationFrame(animationFrame); animationFrame = null; }
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        renderCommandHub();
        break;
    }
  });

  window.addEventListener("resize", resizeCanvas);
  renderCommandHub();

  // Signal to the extension that the webview is ready to receive messages
  vscode.postMessage({ type: "ready" });
})();
