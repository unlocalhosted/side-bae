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

  function renderEmpty() {
    root.innerHTML = `
      <div class="empty-state fade-in">
        <div class="empty-icon">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.4">
            <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
          </svg>
        </div>
        <div class="empty-title">Ready to explore</div>
        <div class="empty-hint"><kbd>${generateShortcut}</kbd> to ask about a feature</div>
      </div>
    `;
  }

  function renderMarkdown(text, opts) {
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
    const kindLabels = { context: "Context", problem: "Problem", solution: "Suggested Fix" };
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
          <div class="edit-label">Suggested Fix</div>
          <pre class="edit-diff">${oldLines}${newLines}</pre>
          <button class="apply-fix-btn">Apply Fix</button>
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
            <div class="card-file">${escapeHtml(node.file)}:${node.startLine}-${node.endLine}</div>
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
                <button class="copy-report-btn">Copy for PR</button>
              </div>
            </div>
          ` : ""}
        </div>
      </div>
      <div class="card-dock">
        ${edgesHtml}
        <div class="card-footer">
          <button class="nav-back-btn" id="btn-back" ${canGoBack ? "" : "disabled"}><span class="nav-key">${backHint}</span> Back</button>
          <button class="stop-btn" id="btn-stop">End</button>
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

    // Apply Fix button
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

  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  window.addEventListener("message", (event) => {
    const message = event.data;
    switch (message.type) {
      case "update":
        renderCard(message.data);
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
        renderEmpty();
        break;
    }
  });

  window.addEventListener("resize", resizeCanvas);
  renderEmpty();

  // Signal to the extension that the webview is ready to receive messages
  vscode.postMessage({ type: "ready" });
})();
