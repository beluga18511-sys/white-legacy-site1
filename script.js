const imagePaths = {
  logo: "images/logo.png",
  banner: "images/banner.jpg",
  general: "images/general.png",
  legal: "images/legal.png",
  illegal: "images/illegal.png",
  decorative: "images/decorative.jpg",
  server: "images/server.jpg",
};

function normalizeSearchText(text = "") {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function isNumberedRuleLine(line) {
  return /^(?:[^A-Za-z0-9\n\r]*\s*)?\d+\.\s+/.test(line.trimStart());
}

function formatRulesText(text) {
  return text
    .split("\n")
    .map((line) => {
      const escapedLine = escapeHtml(line);

      if (isNumberedRuleLine(line)) {
        return `<strong class="rules-line-strong">${escapedLine}</strong>`;
      }

      return escapedLine;
    })
    .join("\n");
}

function buildSearchMap(text) {
  let normalized = "";
  const map = [];

  for (let index = 0; index < text.length; index += 1) {
    const simplified = text[index]
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();

    for (const character of simplified) {
      if (/[a-z0-9]/.test(character)) {
        normalized += character;
        map.push(index);
      }
    }
  }

  return { normalized, map };
}

function getMatchRanges(text, query) {
  const normalizedQuery = normalizeSearchText(query);

  if (!normalizedQuery) {
    return [];
  }

  const { normalized, map } = buildSearchMap(text);
  const ranges = [];
  let searchIndex = 0;

  while (searchIndex < normalized.length) {
    const matchIndex = normalized.indexOf(normalizedQuery, searchIndex);

    if (matchIndex === -1) {
      break;
    }

    const start = map[matchIndex];
    const end = map[matchIndex + normalizedQuery.length - 1] + 1;
    ranges.push([start, end]);
    searchIndex = matchIndex + normalizedQuery.length;
  }

  return ranges;
}

function highlightText(text, query) {
  const ranges = getMatchRanges(text, query);

  if (!ranges.length) {
    return escapeHtml(text);
  }

  let html = "";
  let cursor = 0;

  ranges.forEach(([start, end]) => {
    html += escapeHtml(text.slice(cursor, start));
    html += `<mark>${escapeHtml(text.slice(start, end))}</mark>`;
    cursor = end;
  });

  html += escapeHtml(text.slice(cursor));
  return html;
}

function splitIntoPassages(text) {
  return text
    .replace(/\uFEFF/g, "")
    .replace(/\r\n?/g, "\n")
    .split(/\n\s*\n+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function applyImageSources() {
  const mediaImages = document.querySelectorAll("[data-image-key]");

  mediaImages.forEach((image) => {
    const key = image.dataset.imageKey;
    const source = imagePaths[key];
    const frame = image.closest(".media-frame");

    frame?.classList.add("is-pending");

    const showLoadedState = () => {
      frame?.classList.add("is-loaded");
      frame?.classList.remove("is-fallback");
      frame?.classList.remove("is-pending");
    };

    const showFallbackState = () => {
      frame?.classList.remove("is-loaded");
      frame?.classList.remove("is-pending");
      frame?.classList.add("is-fallback");
      image.removeAttribute("src");
    };

    if (!source) {
      showFallbackState();
      return;
    }

    image.addEventListener("load", showLoadedState, { once: true });
    image.addEventListener("error", showFallbackState, { once: true });
    image.src = source;

    if (image.complete) {
      if (image.naturalWidth > 0) {
        showLoadedState();
      } else {
        showFallbackState();
      }
    }
  });
}

function setupMobileMenu() {
  const navToggle = document.querySelector(".nav-toggle");
  const navLinks = document.querySelector(".nav-links");
  const navItems = document.querySelectorAll(".nav-links a");

  if (!navToggle || !navLinks) {
    return;
  }

  navToggle.addEventListener("click", () => {
    const isOpen = navLinks.classList.toggle("open");
    navToggle.classList.toggle("is-open", isOpen);
    navToggle.setAttribute("aria-expanded", String(isOpen));
    document.body.classList.toggle("menu-open", isOpen);
  });

  navItems.forEach((link) => {
    link.addEventListener("click", () => {
      navLinks.classList.remove("open");
      navToggle.classList.remove("is-open");
      navToggle.setAttribute("aria-expanded", "false");
      document.body.classList.remove("menu-open");
    });
  });
}

function setupActiveNav() {
  const navItems = document.querySelectorAll(".nav-links a");
  const explicitPage = document.body.dataset.page;
  const currentPath = window.location.pathname.split("/").pop() || "index.html";
  const activePage = explicitPage || currentPath;

  navItems.forEach((link) => {
    const isActive = link.getAttribute("href") === activePage;
    link.classList.toggle("active", isActive);
  });
}

function renderSearchResults(reader, query) {
  const resultsBox = reader.querySelector(".rules-search-results");
  const sourceText = reader.dataset.rulesText || "";

  if (!resultsBox) {
    return;
  }

  if (!query.trim()) {
    resultsBox.hidden = true;
    resultsBox.innerHTML = "";
    return;
  }

  const passages = splitIntoPassages(sourceText);
  const matches = passages.filter(
    (passage) => getMatchRanges(passage, query).length > 0
  );

  resultsBox.hidden = false;
  resultsBox.innerHTML = "";

  const head = document.createElement("div");
  head.className = "rules-results-head";

  const title = document.createElement("strong");
  title.textContent = "Résultats de recherche";

  const count = document.createElement("span");
  count.textContent = `${matches.length} résultat${matches.length > 1 ? "s" : ""}`;

  head.append(title, count);
  resultsBox.appendChild(head);

  if (!matches.length) {
    const empty = document.createElement("div");
    empty.className = "rules-empty";
    empty.textContent = "Aucun résultat trouvé.";
    resultsBox.appendChild(empty);
    return;
  }

  matches.forEach((match, index) => {
    const card = document.createElement("article");
    card.className = "rules-result-card";

    const label = document.createElement("small");
    label.textContent = `Passage ${index + 1}`;

    const text = document.createElement("div");
    text.className = "rules-result-text";
    text.innerHTML = highlightText(match, query);

    card.append(label, text);
    resultsBox.appendChild(card);
  });
}

function renderRulesError(contentBox, source) {
  const wrapper = document.createElement("div");
  wrapper.className = "rules-error";

  const title = document.createElement("h2");
  title.textContent = "Impossible de charger le règlement";

  const message = document.createElement("p");
  message.textContent = `Le fichier ${source} n'a pas pu être lu.`;

  const helper = document.createElement("p");
  helper.textContent =
    "Ouvre le site avec un serveur local pour autoriser le chargement des fichiers texte.";

  wrapper.append(title, message, helper);
  contentBox.innerHTML = "";
  contentBox.appendChild(wrapper);
}

function setupRulesSearch() {
  const rulesReaders = document.querySelectorAll(".rules-reader[data-rules-source]");

  rulesReaders.forEach((reader) => {
    const input = reader.querySelector(".rules-search-input");
    const clearButton = reader.querySelector(".rules-clear-button");

    if (!input || !clearButton) {
      return;
    }

    input.addEventListener("input", () => {
      renderSearchResults(reader, input.value);
    });

    clearButton.addEventListener("click", () => {
      input.value = "";
      renderSearchResults(reader, "");
      input.focus();
    });
  });
}

async function loadRulesContent() {
  const rulesReaders = document.querySelectorAll(".rules-reader[data-rules-source]");

  for (const reader of rulesReaders) {
    const source = reader.dataset.rulesSource;
    const contentBox = reader.querySelector(".rules-content");
    const input = reader.querySelector(".rules-search-input");
    const clearButton = reader.querySelector(".rules-clear-button");

    if (!source || !contentBox) {
      continue;
    }

    try {
      const response = await fetch(source, { cache: "no-store" });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const text = (await response.text())
        .replace(/\uFEFF/g, "")
        .replace(/\r\n?/g, "\n")
        .trim();

      reader.dataset.rulesText = text;
      contentBox.innerHTML = formatRulesText(text);

      if (input) {
        input.disabled = false;
      }

      if (clearButton) {
        clearButton.disabled = false;
      }
    } catch (error) {
      console.error("Erreur de chargement du règlement :", error);
      renderRulesError(contentBox, source);
    }
  }
}

function setupRevealAnimations() {
  const revealItems = document.querySelectorAll("[data-reveal]");

  if (!revealItems.length) {
    return;
  }

  if (!("IntersectionObserver" in window)) {
    revealItems.forEach((item) => item.classList.add("visible"));
    return;
  }

  const revealObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }

        entry.target.classList.add("visible");
        observer.unobserve(entry.target);
      });
    },
    {
      threshold: 0.12,
    }
  );

  revealItems.forEach((item) => {
    item.classList.add("reveal");
    revealObserver.observe(item);
  });
}

function setupLexiqueSearch() {
  const lexiqueSearch = document.getElementById("lexiqueSearch");
  const clearLexiqueSearch = document.getElementById("clearLexiqueSearch");
  const lexiqueCards = [...document.querySelectorAll(".lexique-card")];
  const noLexiqueResult = document.getElementById("noLexiqueResult");

  if (
    !lexiqueSearch ||
    !clearLexiqueSearch ||
    !lexiqueCards.length ||
    !noLexiqueResult
  ) {
    return;
  }

  const filterLexiqueCards = () => {
    const searchValue = lexiqueSearch.value.toLowerCase().trim();
    const compactSearchValue = searchValue.replace(/\s+/g, "");
    let visibleCount = 0;

    lexiqueCards.forEach((card) => {
      const cardText = card.textContent.toLowerCase();
      const compactCardText = cardText.replace(/\s+/g, "");
      const isMatch =
        searchValue === "" ||
        cardText.includes(searchValue) ||
        compactCardText.includes(compactSearchValue);

      card.style.display = isMatch ? "block" : "none";

      if (isMatch) {
        visibleCount += 1;
      }
    });

    noLexiqueResult.hidden = searchValue === "" || visibleCount > 0;
  };

  lexiqueSearch.addEventListener("input", filterLexiqueCards);

  clearLexiqueSearch.addEventListener("click", () => {
    lexiqueSearch.value = "";
    lexiqueCards.forEach((card) => {
      card.style.display = "block";
    });
    noLexiqueResult.hidden = true;
    lexiqueSearch.focus();
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const yearElement = document.getElementById("current-year");

  if (yearElement) {
    yearElement.textContent = new Date().getFullYear();
  }

  applyImageSources();
  setupMobileMenu();
  setupActiveNav();
  setupRevealAnimations();
  setupRulesSearch();
  setupLexiqueSearch();
  loadRulesContent();
});
