document.addEventListener("DOMContentLoaded", () => {
  const input = document.getElementById("siteSearch");
  if (!input) {
    console.warn('Search input not found (id="siteSearch").');
    return;
  }

  // Create / get "no results" message below search box
  let noResultsMsg = document.getElementById("noResultsMsg");
  if (!noResultsMsg) {
    noResultsMsg = document.createElement("div");
    noResultsMsg.id = "noResultsMsg";
    noResultsMsg.textContent = "Search Term Not Found.";
    noResultsMsg.style.display = "none";
    noResultsMsg.style.textAlign = "center";
    noResultsMsg.style.color = "#f87171";
    noResultsMsg.style.fontWeight = "bold";
    noResultsMsg.style.marginTop = "12px";
    const container = document.querySelector(".search-container");
    if (container && container.parentNode) container.parentNode.insertBefore(noResultsMsg, container.nextSibling);
    else document.body.appendChild(noResultsMsg);
  }

  input.addEventListener("input", () => performSearch(input.value.trim()));

  function performSearch(query) {
    const body = document.body;
    removeHighlights(body);
    noResultsMsg.style.display = "none";

    const allMainDomains = document.querySelectorAll(".main-domain");
    const allSubDomains = document.querySelectorAll(".subdomain");
    const allControls = document.querySelectorAll(".control");
    const allSubControls = document.querySelectorAll(".subcontrol");

    // Reset all visibility (clear inline styles)
    allMainDomains.forEach(d => (d.style.display = ""));
    allSubDomains.forEach(d => (d.style.display = ""));
    allControls.forEach(d => (d.style.display = ""));
    allSubControls.forEach(d => (d.style.display = ""));

    if (!query) return;

    // Build a safe case-insensitive regex source and a fresh regex per use
    const esc = escapeRegExp(query);
    const regexGlobal = new RegExp(esc, "gi"); // for matching
    const regexCaseInsensitive = new RegExp(esc, "i"); // for single-case checks
    let matchFound = false;

    // Hide all controls and subcontrols initially
    allControls.forEach(c => (c.style.display = "none"));
    allSubControls.forEach(s => (s.style.display = "none"));

    // --- 1) Handle matches inside subcontrols first ---
    allSubControls.forEach(sub => {
      const text = sub.textContent || "";
      if (text.match(regexCaseInsensitive)) {
        matchFound = true;
        sub.style.display = "";
        highlightMatchesInTextNodes(sub, regexGlobal, query);

        const control = sub.closest(".control");
        if (control) {
          control.style.display = "";
          // hide sibling subcontrols that do NOT match
          const siblings = control.querySelectorAll(".subcontrol");
          siblings.forEach(sib => {
            if (sib === sub) return;
            const sibText = sib.textContent || "";
            if (!sibText.match(regexCaseInsensitive)) sib.style.display = "none";
            else sib.style.display = "none"; // per requirement hide other subcontrols even if they have match? keep as hide
          });
        }

        const subdomain = sub.closest(".subdomain");
        const maindomain = sub.closest(".main-domain");
        if (subdomain) subdomain.style.display = "";
        if (maindomain) maindomain.style.display = "";
      }
    });

    // --- 2) Handle matches inside control (excluding those already shown due to subcontrol matches) ---
    allControls.forEach(ctrl => {
      // if control already visible because of a matching subcontrol, skip searching whole control body
      const hasVisibleSub = ctrl.querySelector(".subcontrol:not([style*='display: none'])");
      if (hasVisibleSub) return;

      const text = ctrl.textContent || "";
      if (text.match(regexCaseInsensitive)) {
        matchFound = true;
        ctrl.style.display = "";
        highlightMatchesInTextNodes(ctrl, regexGlobal, query);

        const subdomain = ctrl.closest(".subdomain");
        const maindomain = ctrl.closest(".main-domain");
        if (subdomain) subdomain.style.display = "";
        if (maindomain) maindomain.style.display = "";
      }
    });

    // --- 3) Hide subdomains with no visible controls ---
    allSubDomains.forEach(sub => {
      const visibleControl = sub.querySelector(".control:not([style*='display: none'])");
      sub.style.display = visibleControl ? "" : "none";
    });

    // --- 4) Hide main-domains with no visible subdomains or controls ---
    allMainDomains.forEach(main => {
      const visibleSub = main.querySelector(".subdomain:not([style*='display: none'])");
      const visibleCtrl = main.querySelector(".control:not([style*='display: none'])");
      main.style.display = (visibleSub || visibleCtrl) ? "" : "none";
    });

    // --- 5) Show "no results" message if nothing matched ---
    noResultsMsg.style.display = matchFound ? "none" : "block";
  }

  /**
   * Highlight matched substrings inside text nodes of `root`.
   * - Uses split approach to avoid RegExp.lastIndex issues.
   * - Escapes HTML for safe insertion.
   * - regex should be global+case-insensitive.
   */
  function highlightMatchesInTextNodes(root, regex, query) {
    // Walk nodes with a static copy to avoid mutation issues
    for (const node of Array.from(root.childNodes)) {
      // Skip nested search controls / input / script / style
      if (
        node.nodeType === 1 &&
        (node.tagName === "SCRIPT" ||
         node.tagName === "STYLE" ||
         node.tagName === "INPUT" ||
         node.tagName === "TEXTAREA" ||
         (node.classList && node.classList.contains("search-container")))
      ) {
        continue;
      }

      if (node.nodeType === 3) { // text node
        const text = node.textContent;
        // Quick check: if no match, skip
        if (!text || !text.match(new RegExp(escapeRegExp(query), "i"))) continue;

        // Split text by matches so we keep original casing and content
        const parts = text.split(new RegExp(`(${escapeRegExp(query)})`, "gi"));
        // If no parts or only single part, nothing to do
        if (!parts || parts.length <= 1) continue;

        // Build safe innerHTML by escaping each part and wrapping matches
        const html = parts.map(part => {
          if (part.toLowerCase() === query.toLowerCase()) {
            return `<span class="highlight">${escapeHtml(part)}</span>`;
          } else {
            return escapeHtml(part);
          }
        }).join("");

        const wrapper = document.createElement("span");
        wrapper.innerHTML = html;
        node.replaceWith(wrapper);
      } else if (node.nodeType === 1) {
        // recurse into element nodes
        highlightMatchesInTextNodes(node, regex, query);
      }
    }
  }

  // Remove all .highlight spans (restore plain text)
  function removeHighlights(root) {
    // Remove highlight spans
    const highlights = Array.from(root.querySelectorAll(".highlight"));
    highlights.forEach(span => span.replaceWith(document.createTextNode(span.textContent)));

    // Unwrap any wrapper spans created earlier that now contain only text
    const possibleWrappers = Array.from(root.querySelectorAll("span"));
    possibleWrappers.forEach(s => {
      if (!Array.from(s.children).some(c => c.nodeType === 1)) {
        s.replaceWith(document.createTextNode(s.textContent));
      }
    });
  }

  function escapeRegExp(string) {
    return String(string).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function escapeHtml(unsafe) {
    return String(unsafe)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
});