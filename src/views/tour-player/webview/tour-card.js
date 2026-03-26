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
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const generateShortcut = isMac ? "\u2318\u21E7T" : "Ctrl+Shift+T";
  const backHint = isMac ? "\u2325\u2190" : "Alt+\u2190";
  const fwdHint = isMac ? "\u2325\u2192" : "Alt+\u2192";

  // ── Confetti System ──────────────────────────────────────────────

  /** @type {Array<{x:number, y:number, vx:number, vy:number, w:number, h:number, color:string, rotation:number, rotationSpeed:number, opacity:number, decay:number}>} */
  let particles = [];
  let animationFrame = null;

  function resizeCanvas() {
    canvas.width = document.body.clientWidth;
    canvas.height = document.body.clientHeight;
  }

  /**
   * @param {"burst"|"rain"|"sparkle"} style
   * @param {number} count
   */
  function fireConfetti(style, count) {
    resizeCanvas();

    // Pull colors from VS Code theme via computed styles
    const accent = getComputedStyle(document.body).getPropertyValue("--vscode-textLink-foreground").trim() || "#4fc1ff";
    const fg = getComputedStyle(document.body).getPropertyValue("--vscode-foreground").trim() || "#cccccc";

    const palette = [
      accent,
      lighten(accent, 40),
      lighten(accent, 80),
      fg,
      lighten(fg, 60),
    ];

    for (let i = 0; i < count; i++) {
      const color = palette[Math.floor(Math.random() * palette.length)];
      if (style === "burst") {
        // Burst from center-top
        const angle = (Math.random() * Math.PI) - Math.PI / 2; // -90 to +90 deg
        const speed = 2 + Math.random() * 4;
        particles.push({
          x: canvas.width / 2 + (Math.random() - 0.5) * 40,
          y: 20 + Math.random() * 20,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 1,
          w: 3 + Math.random() * 4,
          h: 2 + Math.random() * 3,
          color,
          rotation: Math.random() * 360,
          rotationSpeed: (Math.random() - 0.5) * 12,
          opacity: 0.9 + Math.random() * 0.1,
          decay: 0.012 + Math.random() * 0.008,
        });
      } else if (style === "rain") {
        // Rain from top, spread across width
        particles.push({
          x: Math.random() * canvas.width,
          y: -10 - Math.random() * 30,
          vx: (Math.random() - 0.5) * 1.5,
          vy: 1.5 + Math.random() * 2.5,
          w: 3 + Math.random() * 5,
          h: 2 + Math.random() * 3,
          color,
          rotation: Math.random() * 360,
          rotationSpeed: (Math.random() - 0.5) * 10,
          opacity: 0.85 + Math.random() * 0.15,
          decay: 0.006 + Math.random() * 0.006,
        });
      } else if (style === "sparkle") {
        // Tiny sparkles from the completion area
        particles.push({
          x: Math.random() * canvas.width,
          y: canvas.height * 0.5 + (Math.random() - 0.5) * 60,
          vx: (Math.random() - 0.5) * 1,
          vy: -0.5 - Math.random() * 1.5,
          w: 2 + Math.random() * 2,
          h: 2 + Math.random() * 2,
          color,
          rotation: Math.random() * 360,
          rotationSpeed: (Math.random() - 0.5) * 15,
          opacity: 0.7 + Math.random() * 0.3,
          decay: 0.02 + Math.random() * 0.015,
        });
      }
    }

    if (!animationFrame) {
      animateConfetti();
    }
  }

  function animateConfetti() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.vy += 0.06; // gravity
      p.y += p.vy;
      p.rotation += p.rotationSpeed;
      p.opacity -= p.decay;

      if (p.opacity <= 0 || p.y > canvas.height + 20) {
        particles.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rotation * Math.PI) / 180);
      ctx.globalAlpha = p.opacity;
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }

    if (particles.length > 0) {
      animationFrame = requestAnimationFrame(animateConfetti);
    } else {
      animationFrame = null;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  /**
   * Lighten a hex color
   * @param {string} hex
   * @param {number} amount 0-255
   * @returns {string}
   */
  function lighten(hex, amount) {
    hex = hex.replace("#", "");
    if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    const num = parseInt(hex, 16);
    const r = Math.min(255, ((num >> 16) & 255) + amount);
    const g = Math.min(255, ((num >> 8) & 255) + amount);
    const b = Math.min(255, (num & 255) + amount);
    return `rgb(${r},${g},${b})`;
  }

  // ── Rendering ────────────────────────────────────────────────────

  function renderEmpty() {
    root.innerHTML = `
      <div class="empty-state fade-in">
        <div class="empty-icon">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.4">
            <path d="M12 2L2 7l10 5 10-5-10-5z"/>
            <path d="M2 17l10 5 10-5"/>
            <path d="M2 12l10 5 10-5"/>
          </svg>
        </div>
        <div class="empty-title">Ready to explore</div>
        <div class="empty-hint">
          <kbd>${generateShortcut}</kbd> to generate a tour
        </div>
      </div>
    `;
  }

  /**
   * @param {string} text
   * @returns {string}
   */
  function renderMarkdown(text) {
    return (
      escapeHtml(text)
        .replace(
          /```(\w*)\n([\s\S]*?)```/g,
          '<pre class="md-code-block"><code>$2</code></pre>'
        )
        .replace(/`([^`]+)`/g, '<code class="md-inline-code">$1</code>')
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
        .replace(/\*(.+?)\*/g, "<em>$1</em>")
        .replace(/^- (.+)$/gm, '<li class="md-list-item">$1</li>')
        .replace(
          /(<li class="md-list-item">.*?<\/li>\n?)+/g,
          '<ul class="md-list">$&</ul>'
        )
        .replace(/\n\n/g, "<br/><br/>")
        .replace(/\n/g, "<br/>")
    );
  }

  /**
   * @param {number} current
   * @param {number} total
   * @returns {string}
   */
  function progressLabel(current, total) {
    if (current === 1) return "starting";
    if (current === total) return "last stop";
    const ratio = current / total;
    if (ratio <= 0.35) return "early on";
    if (ratio <= 0.65) return "midway";
    return "almost there";
  }

  /** @param {{ node: any, breadcrumb: any[], canGoBack: boolean, canGoForward: boolean, currentIndex: number, totalNodes: number, visitedCount: number, isNewTour: boolean }} data */
  function renderCard(data) {
    const { node, breadcrumb, canGoBack, canGoForward, currentIndex, totalNodes, visitedCount, isNewTour } = data;

    const isLeafNode = node.edges.length === 0;
    const isFirstStop = currentIndex === 1 && !canGoBack;
    const allVisited = visitedCount >= totalNodes;
    const justCompletedAll = allVisited && !hasSeenAllNodes;
    const nodeChanged = previousNodeId !== null && previousNodeId !== (breadcrumb[breadcrumb.length - 1]?.id);
    previousNodeId = breadcrumb[breadcrumb.length - 1]?.id ?? null;

    // ── Celebration triggers (skipped if user prefers reduced motion) ──
    if (!prefersReducedMotion) {
      if (isNewTour && isFirstStop) {
        setTimeout(() => fireConfetti("burst", 45), 200);
      }

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

    // ── Edges or completion section ──
    let edgesOrCompletionHtml = "";
    if (isLeafNode) {
      const completionIcon = allVisited
        ? `<svg class="checkmark-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path class="checkmark-path" d="M5 13l4 4L19 7"/>
          </svg>`
        : "";

      const completionMessage = allVisited
        ? "Tour complete. You've explored every stop."
        : currentIndex === totalNodes
          ? "End of the trail. You've seen the full picture."
          : "This path ends here. Use <strong>Back</strong> to explore other paths.";

      edgesOrCompletionHtml = `
        <div class="tour-complete fade-in ${allVisited ? "all-visited" : ""}">
          <div class="complete-line"></div>
          <div class="complete-message">
            ${completionIcon}
            <span>${completionMessage}</span>
          </div>
          ${allVisited ? `<div class="complete-stats">${totalNodes} stops explored across this codebase</div>` : ""}
        </div>
      `;
    } else {
      edgesOrCompletionHtml = `
        <div class="card-edges">
          <div class="card-edges-label">${node.edges.length === 1 ? "Continues to" : "Where to next"}</div>
          ${node.edges
            .map(
              (edge, i) => `
            <button class="edge-link ${nodeChanged ? "edge-enter" : ""}" data-target="${escapeHtml(edge.target)}" style="${nodeChanged ? `animation-delay: ${i * 60}ms` : ""}">
              <span class="arrow">&rarr;</span>
              <span>${escapeHtml(edge.label)}</span>
            </button>
          `
            )
            .join("")}
        </div>
      `;
    }

    // ── Breadcrumb ──
    const label = progressLabel(currentIndex, totalNodes);
    const isLastStop = currentIndex === totalNodes;
    const breadcrumbHtml = `
      <div class="breadcrumb">
        <span class="breadcrumb-progress ${isLastStop ? "progress-glow" : ""}">${currentIndex}/${totalNodes}</span>
        <span class="breadcrumb-label">${label}</span>
        ${breadcrumb.length > 1
          ? breadcrumb
              .map(
                (entry, i) => `
            ${i > 0 ? '<span class="breadcrumb-separator">&rsaquo;</span>' : '<span class="breadcrumb-separator">&mdash;</span>'}
            <button class="breadcrumb-item ${i === breadcrumb.length - 1 ? "current" : ""}" data-node-id="${escapeHtml(entry.id)}">
              ${escapeHtml(entry.title)}
            </button>
          `
              )
              .join("")
          : ""}
      </div>
    `;

    // ── First-stop intro ──
    const introHtml = isFirstStop
      ? `<div class="tour-intro fade-in">This tour has ${totalNodes} stop${totalNodes === 1 ? "" : "s"}. Let's start here.</div>`
      : "";

    // ── Visited progress bar ──
    const visitedPct = Math.round((visitedCount / totalNodes) * 100);
    const visitedBarHtml = totalNodes > 1
      ? `<div class="visited-bar-track"><div class="visited-bar-fill ${allVisited ? "bar-complete" : ""}" style="width: ${visitedPct}%"></div></div>`
      : "";

    root.innerHTML = `
      <div class="tour-card ${nodeChanged ? "card-enter" : ""}">
        ${breadcrumbHtml}
        ${visitedBarHtml}
        ${introHtml}
        <div class="card-header">
          <div class="card-title">${escapeHtml(node.title)}</div>
          <div class="card-file">${escapeHtml(node.file)}:${node.startLine}-${node.endLine}</div>
        </div>
        <div class="card-explanation">${renderMarkdown(node.explanation)}</div>
        ${edgesOrCompletionHtml}
        <div class="nav-buttons">
          <button class="nav-btn secondary" id="btn-back" ${canGoBack ? "" : "disabled"}>
            <span class="nav-key">${backHint}</span> Back
          </button>
          <button class="nav-btn secondary" id="btn-forward" ${canGoForward ? "" : "disabled"}>
            Forward <span class="nav-key">${fwdHint}</span>
          </button>
        </div>
        <button class="stop-btn" id="btn-stop">End tour</button>
      </div>
    `;

    // ── Bind events ──
    root.querySelectorAll(".edge-link").forEach((btn) => {
      btn.addEventListener("click", () => {
        vscode.postMessage({ type: "navigate", nodeId: btn.getAttribute("data-target") });
      });
    });

    root.querySelectorAll(".breadcrumb-item:not(.current)").forEach((btn) => {
      btn.addEventListener("click", () => {
        vscode.postMessage({ type: "navigate", nodeId: btn.getAttribute("data-node-id") });
      });
    });

    const backBtn = document.getElementById("btn-back");
    if (backBtn) backBtn.addEventListener("click", () => vscode.postMessage({ type: "back" }));

    const forwardBtn = document.getElementById("btn-forward");
    if (forwardBtn) forwardBtn.addEventListener("click", () => vscode.postMessage({ type: "forward" }));

    const stopBtn = document.getElementById("btn-stop");
    if (stopBtn) stopBtn.addEventListener("click", () => vscode.postMessage({ type: "stop" }));
  }

  /** @param {string} text */
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
      case "clear":
        previousNodeId = null;
        hasSeenAllNodes = false;
        particles = [];
        if (animationFrame) {
          cancelAnimationFrame(animationFrame);
          animationFrame = null;
        }
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        renderEmpty();
        break;
    }
  });

  window.addEventListener("resize", resizeCanvas);
  renderEmpty();
})();
