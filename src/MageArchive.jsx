import React from "react";
let systemGoogleBooksLoaderPromise = null;
import { useRef, useEffect, useState, useLayoutEffect, useMemo } from "react";
import { loadMageArchive, bootstrapAuthoritativeProfile, startMageBookOnBackend, logMageReadingOnBackend, completeMageBookOnBackend } from "./systemCloud.js";
import { fallbackArchiveBooks } from "./systemArchiveFallback.js";
import { getSystemPublicDomainEdition } from "./systemArchiveReaderCatalog.js";
import { loadSystemArchiveText, searchSystemBooks, resolveSystemOpenLibraryBook, resolveSystemArchivePdf } from "./systemExternal.js";
import { paginateArchiveText } from "./systemArchiveReaderCore.js";
import { todayKey } from "./systemProfileCore.js";
import { PageHero, SectionLabel, SystemField, SystemModalPortal } from "./systemUI.jsx";

export const MAGE_ARCHIVE_RANKS = [
  "E",
  "D",
  "C",
  "B",
  "A",
  "S",
];

export const MAGE_READING_TARGETS = {
  E: "5–10 MIN",
  D: "10–15 MIN",
  C: "20 MIN",
  B: "25–30 MIN",
  A: "30+ MIN",
  S: "40+ MIN",
};

export const MAGE_BOOK_SIGILS = {
  FINANCE: "◇",
  WEALTH: "◆",
  HEALTH: "✚",
  DISCIPLINE: "⟡",
  HABITS: "↻",
  PSYCHOLOGY: "Ψ",
  BIOGRAPHY: "♜",
  FICTION: "✦",
  LEADERSHIP: "♛",
  STRATEGY: "⌁",
  PHILOSOPHY: "Ω",
  PRODUCTIVITY: "▣",
};

export function mageBookSigil(category) {
  const key = String(category || "").trim().toUpperCase();
  return MAGE_BOOK_SIGILS[key] || "✧";
}

export function ensureSystemGoogleBooksViewerApi() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("GOOGLE_BOOKS_VIEWER_UNAVAILABLE"));
  }

  if (window.google?.books?.DefaultViewer) {
    return Promise.resolve(window.google.books);
  }

  if (systemGoogleBooksLoaderPromise) {
    return systemGoogleBooksLoaderPromise;
  }

  systemGoogleBooksLoaderPromise = new Promise((resolve, reject) => {
    const initializeBooks = () => {
      try {
        if (!window.google?.books) {
          reject(new Error("GOOGLE_BOOKS_VIEWER_UNAVAILABLE"));
          return;
        }

        window.google.books.load();
        window.google.books.setOnLoadCallback(() => {
          if (window.google?.books?.DefaultViewer) {
            resolve(window.google.books);
          } else {
            reject(new Error("GOOGLE_BOOKS_VIEWER_UNAVAILABLE"));
          }
        });
      } catch (error) {
        reject(error);
      }
    };

    const existing = document.querySelector(
      'script[data-system-google-books="true"]'
    );

    if (existing) {
      if (window.google?.books) {
        initializeBooks();
      } else {
        existing.addEventListener("load", initializeBooks, { once: true });
        existing.addEventListener(
          "error",
          () => reject(new Error("GOOGLE_BOOKS_SCRIPT_FAILED")),
          { once: true }
        );
      }
      return;
    }

    const script = document.createElement("script");
    script.src = "https://www.google.com/books/jsapi.js";
    script.async = true;
    script.dataset.systemGoogleBooks = "true";
    script.addEventListener("load", initializeBooks, { once: true });
    script.addEventListener(
      "error",
      () => reject(new Error("GOOGLE_BOOKS_SCRIPT_FAILED")),
      { once: true }
    );
    document.head.appendChild(script);
  }).catch((error) => {
    systemGoogleBooksLoaderPromise = null;
    throw error;
  });

  return systemGoogleBooksLoaderPromise;
}

export function GoogleBooksEmbeddedViewer({ volumeId, title, onReady, onFail }) {
  const containerRef = useRef(null);

  useEffect(() => {
    let alive = true;
    let viewer = null;

    if (!volumeId || !containerRef.current) {
      return undefined;
    }

    containerRef.current.innerHTML = "";

    ensureSystemGoogleBooksViewerApi()
      .then(() => {
        if (!alive || !containerRef.current) return;

        viewer = new window.google.books.DefaultViewer(containerRef.current);
        viewer.load(
          volumeId,
          () => {
            if (alive) onFail?.("PREVIEW_UNAVAILABLE");
          },
          () => {
            if (alive) onReady?.();
          }
        );
      })
      .catch((error) => {
        console.warn("GOOGLE BOOKS VIEWER FAILED:", error);
        if (alive) onFail?.(error?.message || "PREVIEW_UNAVAILABLE");
      });

    return () => {
      alive = false;
      viewer = null;
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
    };
  }, [volumeId]);

  return (
    <div
      ref={containerRef}
      className="mage-google-books-viewer"
      aria-label={`${title || "Book"} Google Books reader`}
    />
  );
}

export function normalizeArchiveSearchText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function chooseBestOnlineArchiveBook(activeBook, results = []) {
  if (!activeBook || !Array.isArray(results) || !results.length) {
    return null;
  }

  const targetTitle = normalizeArchiveSearchText(activeBook.title);
  const targetAuthor = normalizeArchiveSearchText(activeBook.author);

  const scored = results.map((book, index) => {
    const resultTitle = normalizeArchiveSearchText(book?.title);
    const resultAuthors = normalizeArchiveSearchText(
      Array.isArray(book?.authors) ? book.authors.join(" ") : ""
    );

    let score = Math.max(0, 30 - index);
    if (book?.embeddable) score += 55;
    if (resultTitle && targetTitle && resultTitle === targetTitle) score += 80;
    else if (
      resultTitle &&
      targetTitle &&
      (resultTitle.includes(targetTitle) || targetTitle.includes(resultTitle))
    ) {
      score += 45;
    }

    if (targetAuthor && resultAuthors.includes(targetAuthor)) score += 40;
    if (book?.public_domain) score += 12;

    return { book, score };
  });

  scored.sort((a, b) => b.score - a.score);

  // Google can return an exact catalog record that cannot be read here next
  // to a legal preview edition. Prefer the credible embeddable edition first.
  const embeddableMatch = scored.find(
    ({ book, score }) =>
      book?.embeddable &&
      score >= 100
  );

  return embeddableMatch?.book || scored[0]?.book || null;
}

export function chooseBestOpenLibraryArchiveBook(activeBook, results = []) {
  if (!activeBook || !Array.isArray(results) || !results.length) {
    return null;
  }

  const targetTitle = normalizeArchiveSearchText(activeBook.title);
  const targetAuthor = normalizeArchiveSearchText(activeBook.author);
  const scored = results.map((book, index) => {
    const resultTitle = normalizeArchiveSearchText(book?.title);
    const resultAuthors = normalizeArchiveSearchText(
      Array.isArray(book?.authors) ? book.authors.join(" ") : ""
    );

    let score = Math.max(0, 30 - index);
    if (book?.embeddable) score += 60;
    else if (book?.direct_url) score += 15;

    if (resultTitle && targetTitle && resultTitle === targetTitle) score += 80;
    else if (
      resultTitle &&
      targetTitle &&
      (resultTitle.includes(targetTitle) || targetTitle.includes(resultTitle))
    ) {
      score += 45;
    }

    if (targetAuthor && resultAuthors.includes(targetAuthor)) score += 40;
    if (book?.is_readable) score += 15;

    return { book, score };
  });

  scored.sort((a, b) => b.score - a.score);

  // Only expose a provider link when the returned title credibly matches the
  // Archive title. A same-app readable edition is always preferred.
  const credible = scored.filter(({ score }) => score >= 100);
  const embeddableMatch = credible.find(({ book }) => book?.embeddable);

  return embeddableMatch?.book || credible[0]?.book || null;
}

export function MageArchive({
  profile,
  saveProfile,
  applyAuthoritativeProfile,
}) {
  const [
    archive,
    setArchive,
  ] = useState(null);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  const [
    notice,
    setNotice,
  ] = useState(null);

  const [
    busyAction,
    setBusyAction,
  ] = useState("");

  const [
    rankFilter,
    setRankFilter,
  ] = useState("ALL");

  const [
    categoryFilter,
    setCategoryFilter,
  ] = useState("ALL");

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    currentPage,
    setCurrentPage,
  ] = useState("");

  const [
    minutes,
    setMinutes,
  ] = useState("15");

  const [
    readingNote,
    setReadingNote,
  ] = useState("");

  const [
    reflection,
    setReflection,
  ] = useState("");

  const [
    readerOpen,
    setReaderOpen,
  ] = useState(false);

  // Selecting a new title changes activeBook on the next render. Keep this
  // intent separately so READ NOW opens the reader only after that book is
  // truly active, rather than relying on a stale closure.
  const [
    pendingReaderBookId,
    setPendingReaderBookId,
  ] = useState("");

  const [
    readerSeconds,
    setReaderSeconds,
  ] = useState(0);

  const [
    readerEngaged,
    setReaderEngaged,
  ] = useState(false);

  const [
    readerDocumentUrl,
    setReaderDocumentUrl,
  ] = useState("");

  const [
    readerDocumentName,
    setReaderDocumentName,
  ] = useState("");

  const [
    onlineBook,
    setOnlineBook,
  ] = useState(null);

  const [
    onlineBookLoading,
    setOnlineBookLoading,
  ] = useState(false);

  const [
    onlineBookError,
    setOnlineBookError,
  ] = useState("");

  const [
    onlineBookViewerReady,
    setOnlineBookViewerReady,
  ] = useState(false);

  const [
    readerLookupNonce,
    setReaderLookupNonce,
  ] = useState(0);

  const [
    onlineBookPdfLoading,
    setOnlineBookPdfLoading,
  ] = useState(false);

  const [
    archiveReaderText,
    setArchiveReaderText,
  ] = useState("");

  const [
    archiveReaderTextLoading,
    setArchiveReaderTextLoading,
  ] = useState(false);

  const [
    archiveReaderTextError,
    setArchiveReaderTextError,
  ] = useState("");

  const [
    readerPageTurn,
    setReaderPageTurn,
  ] = useState(0);

  const [
    readerPageDirection,
    setReaderPageDirection,
  ] = useState("forward");

  const readerLastActivityRef =
    useRef(Date.now());

  const readerOwnedUrlRef =
    useRef("");

  async function refreshArchive({
    quiet = false,
  } = {}) {
    if (
      profile.path !==
      "MAGE"
    ) {
      return;
    }

    if (!quiet) {
      setLoading(true);
    }

    setError("");

    try {
      const state =
        await loadMageArchive();

      setArchive(
        state
      );
    } catch (archiveError) {
      console.error(
        "MAGE ARCHIVE LOAD FAILED:",
        archiveError
      );

      setError(
        archiveError?.message ||
        "THE GRAND ARCHIVE COULD NOT BE LOADED."
      );
    } finally {
      if (!quiet) {
        setLoading(false);
      }
    }
  }

  async function refreshPlayer() {
    try {
      const cloud =
        await bootstrapAuthoritativeProfile();

      if (cloud) {
        applyAuthoritativeProfile(
          cloud
        );
      }
    } catch (profileError) {
      console.warn(
        "MAGE ARCHIVE PROFILE REFRESH DEFERRED:",
        profileError
      );
    }
  }

  useEffect(() => {
    void refreshArchive();
  }, [
    profile.path,
  ]);

  const authoritativeBooks =
    Array.isArray(
      archive?.books
    )
      ? archive.books
      : [];

  // The authoritative catalog remains the only route to official Archive XP
  // and Knowledge Rank. A built-in recovery shelf prevents the screen from
  // looking empty while that RPC or the provider is temporarily unavailable.
  const usingRecoveryShelf =
    authoritativeBooks.length ===
    0;

  const books =
    usingRecoveryShelf
      ? fallbackArchiveBooks(
          archive?.knowledge_rank ||
            "E",
          profile.archiveFallback
            ?.progress ||
            {}
        )
      : authoritativeBooks;

  const activeBook =
    books.find(
      (book) =>
        book.id ===
        (
          usingRecoveryShelf
            ? profile.archiveFallback
                ?.activeBookId
            : archive?.active_book_id
        )
    ) ||
    books.find(
      (book) =>
        book.progress
          ?.status ===
        "ACTIVE"
    ) ||
    null;

  useEffect(() => {
    if (
      readerOwnedUrlRef.current
    ) {
      URL.revokeObjectURL(
        readerOwnedUrlRef.current
      );
      readerOwnedUrlRef.current =
        "";
    }

    setReaderOpen(false);
    setReaderSeconds(0);
    setReaderEngaged(false);
    setReaderDocumentUrl("");
    setReaderDocumentName("");
    setOnlineBook(null);
    setOnlineBookLoading(false);
    setOnlineBookError("");
    setOnlineBookViewerReady(false);
    setReaderLookupNonce(0);
    setOnlineBookPdfLoading(false);
    setArchiveReaderText("");
    setArchiveReaderTextLoading(false);
    setArchiveReaderTextError("");
    setReaderPageTurn(0);
    setReaderPageDirection("forward");

    if (!activeBook) {
      setCurrentPage(
        ""
      );
      setReflection(
        ""
      );
      return;
    }

    setCurrentPage(
      String(
        activeBook.progress
          ?.current_page ||
        0
      )
    );

    setReflection(
      activeBook.progress
        ?.reflection ||
      ""
    );

    setMinutes(
      activeBook.rank ===
      "E"
        ? "10"
        : activeBook.rank ===
            "D"
          ? "15"
          : activeBook.rank ===
              "C"
            ? "20"
            : activeBook.rank ===
                "B"
              ? "25"
              : activeBook.rank ===
                  "A"
                ? "30"
                : "40"
    );
  }, [
    activeBook?.id,
  ]);

  useEffect(() => {
    if (
      !pendingReaderBookId ||
      activeBook?.id !==
        pendingReaderBookId
    ) {
      return;
    }

    readerLastActivityRef.current =
      Date.now();
    setCurrentPage((previous) =>
      String(
        Math.max(
          1,
          Number(previous || 1) ||
            1
        )
      )
    );
    setReaderOpen(true);
    setPendingReaderBookId("");
  }, [
    activeBook?.id,
    pendingReaderBookId,
  ]);

  useEffect(() => {
    return () => {
      if (
        readerOwnedUrlRef.current
      ) {
        URL.revokeObjectURL(
          readerOwnedUrlRef.current
        );
      }
    };
  }, []);

  useEffect(() => {
    if (
      !readerOpen ||
      !activeBook ||
      readerDocumentUrl ||
      onlineBook
    ) {
      return undefined;
    }

    let alive = true;

    setOnlineBookLoading(true);
    setOnlineBookError("");
    setOnlineBookViewerReady(false);
    setOnlineBookPdfLoading(false);

    const embeddedEdition =
      getSystemPublicDomainEdition(
        activeBook
      );

    // The curated public-domain edition is deliberately first. Gutenberg does
    // not publish a PDF for every title, so non-bundled books are fetched from
    // an allowlisted full-text endpoint and rendered as native fixed pages.
    // The player stays inside THE SYSTEM instead of seeing a provider page.
    if (embeddedEdition) {
      const isLocalPdf =
        embeddedEdition.readerMode ===
        "SYSTEM_LOCAL_PDF";
      const isNativeText =
        embeddedEdition.readerMode ===
        "SYSTEM_NATIVE_TEXT";

      setOnlineBook({
        type: "book",
        provider: "SYSTEM_PUBLIC_DOMAIN",
        title: activeBook.title,
        authors: activeBook.author
          ? [activeBook.author]
          : [],
        availability_status: "FULL • PUBLIC DOMAIN • IN-APP",
        access_label: embeddedEdition.sourceLabel,
        direct_url: embeddedEdition.sourceUrl,
        reader_mode: isLocalPdf
          ? "SYSTEM_EMBEDDED_PDF"
          : "SYSTEM_NATIVE_TEXT",
        embeddable: true,
        pdf_url: isLocalPdf
          ? embeddedEdition.pdfUrl
          : null,
        page_count: isLocalPdf
          ? embeddedEdition.pageCount
          : null,
        edition_label: embeddedEdition.editionLabel,
        reader_key: embeddedEdition.key,
      });
      setOnlineBookLoading(false);

      if (!isNativeText) {
        return undefined;
      }

      setArchiveReaderTextLoading(true);
      setArchiveReaderTextError("");

      void loadSystemArchiveText(
        embeddedEdition.key
      )
        .then((edition) => {
          if (!alive) {
            return;
          }

          const text = String(
            edition?.text ||
            ""
          ).trim();

          if (!text) {
            throw new Error(
              "ARCHIVE_TEXT_UNAVAILABLE"
            );
          }

          setArchiveReaderText(text);
          setArchiveReaderTextError("");
          readerLastActivityRef.current =
            Date.now();
        })
        .catch((textError) => {
          if (!alive) {
            return;
          }

          console.warn(
            "GRAND ARCHIVE NATIVE TEXT DEFERRED:",
            textError
          );
          setArchiveReaderText("");
          setArchiveReaderTextError(
            textError?.message ===
            "UPSTREAM_TIMEOUT"
              ? "THE CURATED EDITION TOOK TOO LONG TO REACH THE ARCHIVE. RETRY THE SYNC."
              : "THE CURATED EDITION COULD NOT BE PREPARED. RETRY THE SYNC."
          );
        })
        .finally(() => {
          if (alive) {
            setArchiveReaderTextLoading(false);
          }
        });

      return () => {
        alive = false;
      };
    }

    // Curated public-domain titles have a verified legal reader link stored
    // with the Archive record. Prefer it over a provider search so the player
    // is never sent through a random, region-dependent edition lookup.
    if (activeBook.legal_read_url) {
      setOnlineBook({
        type: "book",
        provider: "CURATED_LEGAL_LINK",
        title: activeBook.title,
        authors: activeBook.author
          ? [activeBook.author]
          : [],
        availability_status: "VERIFIED LEGAL EDITION",
        access_label:
          activeBook.legal_read_label ||
          "OPEN VERIFIED EDITION",
        direct_url:
          activeBook.legal_read_url,
        reader_mode: "EXTERNAL_LEGAL_READER",
        embeddable: false,
      });
      setOnlineBookError(
        "A verified legal online edition is ready for this title. Open it in a new tab, then return to THE SYSTEM to keep your reading time and notes together."
      );
      setOnlineBookLoading(false);

      return undefined;
    }

    const query = [
      `intitle:${activeBook.title}`,
      activeBook.author
        ? `inauthor:${activeBook.author}`
        : "",
    ]
      .filter(Boolean)
      .join(" ");

    Promise.allSettled([
      searchSystemBooks(query, {
        maxResults: 20,
      }),
      resolveSystemOpenLibraryBook(
        {
          title: activeBook.title,
          author: activeBook.author || "",
        },
        {
          maxResults: 10,
        }
      ),
    ])
      .then(([googleResult, openLibraryResult]) => {
        if (!alive) return;

        const googleBooks =
          googleResult.status === "fulfilled"
            ? googleResult.value
            : [];
        const openLibraryBooks =
          openLibraryResult.status === "fulfilled"
            ? openLibraryResult.value
            : [];
        const googleMatch =
          chooseBestOnlineArchiveBook(
            activeBook,
            googleBooks
          );
        const openLibraryMatch =
          chooseBestOpenLibraryArchiveBook(
            activeBook,
            openLibraryBooks
          );
        const match =
          openLibraryMatch?.embeddable
            ? openLibraryMatch
            : googleMatch?.embeddable
              ? googleMatch
              : openLibraryMatch?.direct_url
                ? openLibraryMatch
                : googleMatch ||
                  openLibraryMatch ||
                  null;

        if (match) {
          setOnlineBook(match);
          setOnlineBookError(
            match.embeddable
              ? ""
              : match.provider === "OPEN_LIBRARY" && match.direct_url
                ? "OPEN LIBRARY FOUND A LEGAL READER OR BORROW PAGE FOR THIS TITLE."
                : "AN ONLINE RECORD WAS FOUND, BUT THIS EDITION CANNOT BE EMBEDDED HERE."
          );

          // A public Open Library result initially opens the provider's legal
          // BookReader. When its matching Internet Archive item also exposes a
          // public PDF, replace that surface with the native browser PDF reader
          // so the Archive page controls can turn pages smoothly.
          if (
            match.provider === "OPEN_LIBRARY" &&
            match.embeddable &&
            match.is_readable &&
            match.internet_archive_id
          ) {
            setOnlineBookPdfLoading(true);

            void resolveSystemArchivePdf(
              match.internet_archive_id
            )
              .then((pdf) => {
                if (!alive || !pdf?.pdf_url) {
                  return;
                }

                setOnlineBook((previous) =>
                  previous?.internet_archive_id ===
                  match.internet_archive_id
                    ? {
                        ...previous,
                        pdf_url:
                          pdf.pdf_url,
                        pdf_name:
                          pdf.file_name ||
                          "",
                      }
                    : previous
                );
              })
              .catch((pdfError) => {
                console.warn(
                  "GRAND ARCHIVE PDF LOOKUP DEFERRED:",
                  pdfError
                );
              })
              .finally(() => {
                if (alive) {
                  setOnlineBookPdfLoading(false);
                }
              });
          }

          return;
        }

        const firstFailure =
          googleResult.status === "rejected"
            ? googleResult.reason
            : openLibraryResult.status === "rejected"
              ? openLibraryResult.reason
              : null;

        if (firstFailure) {
          console.warn(
            "GRAND ARCHIVE ONLINE BOOK LOOKUP FAILED:",
            firstFailure
          );
        }

        setOnlineBookError(
          firstFailure?.message ||
            "NO LEGAL ONLINE READER WAS FOUND FOR THIS TITLE."
        );
      })
      .finally(() => {
        if (alive) {
          setOnlineBookLoading(false);
        }
      });

    return () => {
      alive = false;
    };
  }, [
    readerOpen,
    activeBook?.id,
    readerDocumentUrl,
    readerLookupNonce,
  ]);

  // The reader is a focused mode, not a page section. Lock the document while
  // it is open and restore the exact Archive scroll position when it closes.
  useLayoutEffect(() => {
    if (!readerOpen) {
      return undefined;
    }

    const html = document.documentElement;
    const body = document.body;
    const scrollY =
      window.scrollY ||
      html.scrollTop ||
      body.scrollTop ||
      0;
    const scrollX =
      window.scrollX ||
      html.scrollLeft ||
      body.scrollLeft ||
      0;
    const scrollbarWidth =
      window.innerWidth -
      html.clientWidth;
    const previous = {
      bodyPosition:
        body.style.position,
      bodyTop:
        body.style.top,
      bodyLeft:
        body.style.left,
      bodyWidth:
        body.style.width,
      bodyOverflow:
        body.style.overflow,
      bodyPaddingRight:
        body.style.paddingRight,
      htmlOverflow:
        html.style.overflow,
      htmlScrollBehavior:
        html.style.scrollBehavior,
    };

    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = `-${scrollX}px`;
    body.style.width = "100%";
    body.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      body.style.paddingRight =
        `${scrollbarWidth}px`;
    }
    html.style.overflow = "hidden";

    return () => {
      body.style.position =
        previous.bodyPosition;
      body.style.top =
        previous.bodyTop;
      body.style.left =
        previous.bodyLeft;
      body.style.width =
        previous.bodyWidth;
      body.style.overflow =
        previous.bodyOverflow;
      body.style.paddingRight =
        previous.bodyPaddingRight;
      html.style.overflow =
        previous.htmlOverflow;
      html.style.scrollBehavior = "auto";
      window.scrollTo(scrollX, scrollY);
      html.style.scrollBehavior =
        previous.htmlScrollBehavior;
    };
  }, [
    readerOpen,
  ]);

  useEffect(() => {
    if (!readerOpen) {
      setReaderEngaged(false);
      return undefined;
    }

    const markReaderActivity = () => {
      readerLastActivityRef.current =
        Date.now();
    };

    markReaderActivity();

    const activityEvents = [
      "pointerdown",
      "pointermove",
      "keydown",
      "scroll",
      "wheel",
      "touchstart",
    ];

    activityEvents.forEach(
      (eventName) =>
        window.addEventListener(
          eventName,
          markReaderActivity,
          { passive: true }
        )
    );

    const timer =
      window.setInterval(() => {
        const visible =
          typeof document ===
            "undefined" ||
          document.visibilityState ===
            "visible";

        const recentlyActive =
          Date.now() -
            readerLastActivityRef.current <
          120000;

        const shouldCount =
          Boolean(
            visible &&
            recentlyActive
          );

        setReaderEngaged(
          shouldCount
        );

        if (shouldCount) {
          setReaderSeconds(
            (previous) =>
              previous + 1
          );
        }
      }, 1000);

    return () => {
      window.clearInterval(
        timer
      );

      activityEvents.forEach(
        (eventName) =>
          window.removeEventListener(
            eventName,
            markReaderActivity
          )
      );
    };
  }, [
    readerOpen,
    activeBook?.id,
  ]);

  const readerClock = (() => {
    const hours = Math.floor(
      readerSeconds / 3600
    );
    const mins = Math.floor(
      readerSeconds % 3600 / 60
    );
    const secs =
      readerSeconds % 60;

    return [hours, mins, secs]
      .map((value) =>
        String(value).padStart(
          2,
          "0"
        )
      )
      .join(":");
  })();

  const readerTrackedMinutes =
    Math.floor(
      readerSeconds / 60
    );

  const readerPageNumber =
    Math.max(
      1,
      Math.round(
        Number(
          currentPage ||
          1
        )
      ) ||
        1
    );

  const archiveReaderPages =
    useMemo(
      () =>
        paginateArchiveText(
          archiveReaderText
        ),
      [archiveReaderText]
    );

  const readerHasNativeText =
    archiveReaderPages.length >
    0;

  const readerPageLimit =
    readerHasNativeText
      ? archiveReaderPages.length
      : Number(
          onlineBook?.page_count ||
          0
        ) > 0
        ? Math.max(
            1,
            Number(
              onlineBook.page_count
            )
          )
        : Number.MAX_SAFE_INTEGER;

  const resolvedReaderPageNumber =
    Math.min(
      readerPageNumber,
      readerPageLimit
    );

  const readerDocumentSource =
    readerDocumentUrl
      ? readerDocumentUrl +
        "#page=" +
        resolvedReaderPageNumber +
        "&toolbar=1&navpanes=0"
      : "";

  const onlineBookPdfSource =
    onlineBook?.pdf_url
      ? onlineBook.pdf_url +
        "#page=" +
        resolvedReaderPageNumber +
        "&toolbar=1&navpanes=0"
      : "";

  const readerUsesNativePdf =
    Boolean(
      readerDocumentSource ||
      onlineBookPdfSource
    );

  const readerHasPageSurface =
    Boolean(
      readerUsesNativePdf ||
      readerHasNativeText
    );

  const archiveReaderPage =
    readerHasNativeText
      ? archiveReaderPages[
          resolvedReaderPageNumber -
          1
        ] || ""
      : "";

  useEffect(() => {
    if (
      readerHasNativeText &&
      readerPageNumber >
        readerPageLimit
    ) {
      setCurrentPage(
        String(readerPageLimit)
      );
    }
  }, [
    readerHasNativeText,
    readerPageLimit,
    readerPageNumber,
  ]);

  function moveReaderPage(
    direction
  ) {
    const next = Math.max(
      1,
      Math.min(
        readerPageLimit,
        resolvedReaderPageNumber +
          direction
      )
    );

    if (
      next ===
      resolvedReaderPageNumber
    ) {
      return;
    }

    setReaderPageDirection(
      direction < 0
        ? "backward"
        : "forward"
    );
    setReaderPageTurn(
      (previous) =>
        previous +
        1
    );
    setCurrentPage(
      String(next)
    );
    readerLastActivityRef.current =
      Date.now();
  }

  function openReader() {
    if (!activeBook) {
      return;
    }

    readerLastActivityRef.current =
      Date.now();
    setCurrentPage((previous) =>
      String(
        Math.max(
          1,
          Number(previous || 1) ||
            1
        )
      )
    );
    setReaderOpen(true);
  }

  function closeReader() {
    setReaderOpen(false);

    if (
      readerTrackedMinutes > 0
    ) {
      setMinutes(
        String(
          readerTrackedMinutes
        )
      );
    }
  }

  function retryOnlineEdition() {
    if (!activeBook || readerDocumentUrl) {
      return;
    }

    setOnlineBook(null);
    setOnlineBookError("");
    setOnlineBookViewerReady(false);
    setOnlineBookPdfLoading(false);
    setArchiveReaderText("");
    setArchiveReaderTextLoading(false);
    setArchiveReaderTextError("");
    setReaderLookupNonce((previous) => previous + 1);
  }

  function importReaderPdf(
    event
  ) {
    const file =
      event.target.files?.[0];

    if (!file) {
      return;
    }

    const isPdf =
      file.type ===
        "application/pdf" ||
      file.name
        .toLowerCase()
        .endsWith(".pdf");

    if (!isPdf) {
      setError(
        "THE ARCHIVE READER CURRENTLY ACCEPTS PDF BOOKS."
      );
      event.target.value =
        "";
      return;
    }

    if (
      readerOwnedUrlRef.current
    ) {
      URL.revokeObjectURL(
        readerOwnedUrlRef.current
      );
    }

    const objectUrl =
      URL.createObjectURL(file);

    readerOwnedUrlRef.current =
      objectUrl;

    setReaderDocumentUrl(
      objectUrl
    );
    setReaderDocumentName(
      file.name
    );
    setArchiveReaderTextLoading(false);
    setArchiveReaderTextError("");
    setError("");
    readerLastActivityRef.current =
      Date.now();
  }

  const categories =
    Array.from(
      new Set(
        books
          .map(
            (book) =>
              book.category
          )
          .filter(Boolean)
      )
    ).sort();

  const filteredBooks =
    books.filter(
      (book) => {
        const matchesRank =
          rankFilter ===
            "ALL" ||
          book.rank ===
            rankFilter;

        const matchesCategory =
          categoryFilter ===
            "ALL" ||
          book.category ===
            categoryFilter;

        const needle =
          search
            .trim()
            .toLowerCase();

        const matchesSearch =
          !needle ||
          (
            String(
              book.title ||
              ""
            ) +
            " " +
            String(
              book.author ||
              ""
            ) +
            " " +
            String(
              book.category ||
              ""
            )
          )
            .toLowerCase()
            .includes(
              needle
            );

        return (
          matchesRank &&
          matchesCategory &&
          matchesSearch
        );
      }
    );

  const completedBooks =
    books.filter(
      (book) =>
        book.progress
          ?.status ===
        "COMPLETED"
    );

  function progressPercent(
    book
  ) {
    const pages =
      Number(
        book?.estimated_pages ||
        0
      );

    const current =
      Number(
        book?.progress
          ?.current_page ||
        0
      );

    if (!pages) {
      return 0;
    }

    return Math.max(
      0,
      Math.min(
        100,
        Math.round(
          current /
          pages *
          100
        )
      )
    );
  }

  async function startBook(
    book,
    {
      openReaderAfterStart = false,
    } = {}
  ) {
    if (
      !book?.unlocked ||
      busyAction
    ) {
      return;
    }

    setBusyAction(
      "start-" +
      book.id
    );

    setError("");
    setNotice(
      null
    );

    try {
      if (book.fallback) {
        const progress = {
          ...(profile.archiveFallback
            ?.progress ||
            {}),
          [book.id]: {
            ...(profile.archiveFallback
              ?.progress?.[
                book.id
              ] ||
              {}),
            status: "ACTIVE",
            current_page:
              Number(
                profile.archiveFallback
                  ?.progress?.[
                    book.id
                  ]?.current_page ||
                0
              ),
            total_minutes:
              Number(
                profile.archiveFallback
                  ?.progress?.[
                    book.id
                  ]?.total_minutes ||
                0
              ),
          },
        };

        saveProfile({
          ...profile,
          archiveFallback: {
            ...profile.archiveFallback,
            activeBookId: book.id,
            progress,
          },
        });

        if (openReaderAfterStart) {
          setPendingReaderBookId(
            book.id
          );
        }

        setNotice({
          type: "SUCCESS",
          text:
            book.title +
            " • RECOVERY READER ACTIVATED • OPENING THE ARCHIVE READER • OFFICIAL XP WILL RESUME WHEN THE CLOUD CATALOG RECONNECTS",
        });
        return;
      }

      await startMageBookOnBackend(
        book.id
      );

      await refreshArchive({
        quiet:
          true,
      });

      if (openReaderAfterStart) {
        setPendingReaderBookId(
          book.id
        );
      }

      setNotice({
        type:
          "SUCCESS",
        text:
          book.title +
          " • READING MISSION ACTIVATED • OPENING READER",
      });
    } catch (startError) {
      setError(
        startError?.message ||
        "THE SYSTEM COULD NOT ACTIVATE THIS BOOK."
      );
    } finally {
      setBusyAction(
        ""
      );
    }
  }

  async function logReading() {
    if (
      !activeBook ||
      busyAction
    ) {
      return;
    }

    const page =
      Number(
        currentPage
      );

    const manualMinutes =
      Number(
        minutes
      );

    const sessionMinutes =
      readerTrackedMinutes > 0
        ? Math.max(
            Number.isFinite(
              manualMinutes
            )
              ? manualMinutes
              : 0,
            readerTrackedMinutes
          )
        : manualMinutes;

    if (
      !Number.isFinite(
        page
      ) ||
      page < 0
    ) {
      setError(
        "ENTER YOUR CURRENT PAGE."
      );
      return;
    }

    if (
      !Number.isFinite(
        sessionMinutes
      ) ||
      sessionMinutes < 1 ||
      sessionMinutes > 240
    ) {
      setError(
        "READING TIME MUST BE BETWEEN 1 AND 240 MINUTES."
      );
      return;
    }

    setBusyAction(
      "log"
    );

    setError("");
    setNotice(
      null
    );

    try {
      if (activeBook.fallback) {
        const existing =
          profile.archiveFallback
            ?.progress?.[
              activeBook.id
            ] ||
          {};

        const nextProgress = {
          ...(profile.archiveFallback
            ?.progress ||
            {}),
          [activeBook.id]: {
            ...existing,
            status: "ACTIVE",
            current_page: page,
            total_minutes:
              Number(
                existing.total_minutes ||
                0
              ) + sessionMinutes,
            last_note:
              readingNote.trim() ||
              "",
            updated_at:
              new Date()
                .toISOString(),
          },
        };

        saveProfile({
          ...profile,
          archiveFallback: {
            ...profile.archiveFallback,
            activeBookId:
              activeBook.id,
            progress: nextProgress,
          },
        });

        setReadingNote("");
        setNotice({
          type: "SUCCESS",
          text:
            "READING SAVED LOCALLY • " +
            sessionMinutes +
            " MIN • PAGE " +
            page +
            " • NO XP WAS AWARDED IN RECOVERY MODE",
        });
        return;
      }

      const result =
        await logMageReadingOnBackend({
          bookId:
            activeBook.id,
          currentPage:
            page,
          minutes:
            sessionMinutes,
          note:
            readingNote.trim() ||
            null,
          sessionDate:
            todayKey(),
        });

      await refreshArchive({
        quiet:
          true,
      });

      if (
        Number(
          result?.daily_xp ||
          0
        ) >
        0
      ) {
        await refreshPlayer();
      }

      setReadingNote(
        ""
      );

      setNotice({
        type:
          "SUCCESS",
        text:
          "READING LOGGED • " +
          sessionMinutes +
          " MIN • PAGE " +
          page +
          (
            Number(
              result?.daily_xp ||
              0
            ) >
            0
              ? " • +10 XP"
              : ""
          ),
      });
    } catch (logError) {
      setError(
        logError?.message ||
        "THE SYSTEM COULD NOT RECORD THIS READING SESSION."
      );
    } finally {
      setBusyAction(
        ""
      );
    }
  }

  async function clearBook() {
    if (
      !activeBook ||
      busyAction
    ) {
      return;
    }

    if (
      reflection
        .trim()
        .length <
      20
    ) {
      setError(
        "FINAL REFLECTION MUST EXPLAIN WHAT THE BOOK CHANGED OR TAUGHT YOU."
      );
      return;
    }

    setBusyAction(
      "complete"
    );

    setError("");
    setNotice(
      null
    );

    try {
      if (activeBook.fallback) {
        const progress = {
          ...(profile.archiveFallback
            ?.progress ||
            {}),
          [activeBook.id]: {
            ...(profile.archiveFallback
              ?.progress?.[
                activeBook.id
              ] ||
              {}),
            status: "COMPLETED",
            current_page:
              Number(
                currentPage ||
                activeBook.estimated_pages ||
                0
              ),
            reflection:
              reflection.trim(),
            completed_at:
              new Date()
                .toISOString(),
          },
        };

        saveProfile({
          ...profile,
          archiveFallback: {
            ...profile.archiveFallback,
            activeBookId: "",
            progress,
          },
        });

        setNotice({
          type: "SUCCESS",
          text:
            "RECOVERY BOOK MARKED COMPLETE • OFFICIAL ARCHIVE XP AND KNOWLEDGE RANK REQUIRE CLOUD VERIFICATION",
        });
        return;
      }

      const result =
        await completeMageBookOnBackend({
          bookId:
            activeBook.id,
          reflection:
            reflection.trim(),
        });

      await Promise.all([
        refreshArchive({
          quiet:
            true,
        }),
        refreshPlayer(),
      ]);

      setNotice({
        type:
          "SUCCESS",
        text:
          "BOOK CLEARED — " +
          activeBook.title +
          " • +" +
          Number(
            result?.xp_awarded ||
            activeBook.xp_reward ||
            0
          ) +
          " XP",
      });
    } catch (completeError) {
      setError(
        completeError?.message ||
        "THE SYSTEM COULD NOT CLEAR THIS BOOK."
      );
    } finally {
      setBusyAction(
        ""
      );
    }
  }

  if (
    profile.path !==
    "MAGE"
  ) {
    return (
      <div className="page">
        <PageHero
          eyebrow="CLASS-BOUND KNOWLEDGE SYSTEM"
          title="GRAND ARCHIVE"
          text="This progression branch belongs exclusively to the Mage class."
        />

        <div className="mage-archive-locked card3d">
          <span>
            🔒
          </span>

          <h3>
            MAGE CLASS REQUIRED
          </h3>

          <p>
            Knowledge Rank and Archive rewards only exist for Mages.
          </p>
        </div>
      </div>
    );
  }

  const knowledgeRank =
    archive?.knowledge_rank ||
    "E";

  const activeProgress =
    activeBook
      ?.progress ||
    null;

  const activePercent =
    activeBook
      ? progressPercent(
          activeBook
        )
      : 0;

  const clearThreshold =
    activeBook
      ?.estimated_pages
      ? Math.max(
          1,
          Math.floor(
            Number(
              activeBook
                .estimated_pages
            ) *
            0.85
          )
        )
      : 1;

  const canClear =
    Boolean(
      activeBook &&
      Number(
        activeProgress
          ?.current_page ||
        0
      ) >=
        clearThreshold
    );

  return (
    <div className="page mage-archive-page">
      <PageHero
        eyebrow="MAGE-EXCLUSIVE KNOWLEDGE PROGRESSION"
        title="THE GRAND ARCHIVE"
        text="Knowledge becomes your weapon. Read real books, build the habit, rise through E–S Knowledge Rank and convert learning into permanent progression."
      />

      <div className="mage-archive-summary">
        <div className="card3d">
          <small>
            KNOWLEDGE RANK
          </small>

          <strong>
            {knowledgeRank}
          </strong>

          <span>
            MAGE
          </span>
        </div>

        <div className="card3d">
          <small>
            BOOKS CLEARED
          </small>

          <strong>
            {Number(
              archive
                ?.completed_count ||
              0
            )}
          </strong>

          <span>
            PERMANENT
          </span>
        </div>

        <div className="card3d">
          <small>
            {usingRecoveryShelf
              ? "RECOVERY SHELF"
              : "CLOUD CATALOG"}
          </small>

          <strong>
            {books.length}
          </strong>

          <span>
            {usingRecoveryShelf
              ? "LOCAL TITLES"
              : "LIVE TITLES"}
          </span>
        </div>

        <div className="card3d">
          <small>
            DAILY READING
          </small>

          <strong>
            +10
          </strong>

          <span>
            XP • FIRST 5+ MIN
          </span>
        </div>
      </div>

      <div className="mage-rank-track card3d">
        {MAGE_ARCHIVE_RANKS.map(
          (rank) => {
            const currentIndex =
              MAGE_ARCHIVE_RANKS.indexOf(
                knowledgeRank
              );

            const rankIndex =
              MAGE_ARCHIVE_RANKS.indexOf(
                rank
              );

            const open =
              rankIndex <=
              currentIndex;

            return (
              <div
                key={rank}
                className={
                  "mage-rank-node " +
                  (
                    rank ===
                    knowledgeRank
                      ? "current"
                      : open
                        ? "open"
                        : "locked"
                  )
                }
              >
                <span>
                  {open
                    ? "◇"
                    : "×"}
                </span>

                <strong>
                  {rank}
                </strong>

                <small>
                  {
                    MAGE_READING_TARGETS[
                      rank
                    ]
                  }
                </small>
              </div>
            );
          }
        )}
      </div>

      {usingRecoveryShelf && (
        <div className="mage-archive-recovery card3d">
          <span>◌</span>
          <div>
            <small>ARCHIVE RECOVERY MODE</small>
            <strong>BOOKS ARE AVAILABLE WHILE THE CLOUD CATALOG RECONNECTS</strong>
            <p>
              You can open, read and keep private local notes here. Official XP, Knowledge Rank and book clearance resume only through the live Supabase Archive catalog.
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              refreshArchive()
            }
          >
            RETRY CATALOG
          </button>
        </div>
      )}

      {(error ||
        notice) && (
        <div
          className={
            "mage-archive-notice " +
            (
              error
                ? "error"
                : "success"
            )
          }
        >
          <span>
            {error
              ? "⚠"
              : "✓"}
          </span>

          <strong>
            {error ||
            notice?.text}
          </strong>

          <button
            type="button"
            onClick={() => {
              setError("");
              setNotice(
                null
              );
            }}
          >
            ×
          </button>
        </div>
      )}

      {loading ? (
        <div className="mage-archive-loading card3d">
          <span>
            ◇
          </span>

          <strong>
            OPENING GRAND ARCHIVE...
          </strong>
        </div>
      ) : (
        <>
          <SectionLabel
            number="I"
            title="ACTIVE GRIMOIRE"
          />

          {activeBook ? (
            <div className="mage-active-book card3d">
              <div
                className="mage-book-sigil"
                data-rank={activeBook.rank}
              >
                <small className="mage-active-cover-kicker">
                  ACTIVE GRIMOIRE
                </small>

                <div
                  className="mage-active-cover-emblem"
                  aria-hidden="true"
                >
                  <span>
                    {mageBookSigil(activeBook.category)}
                  </span>
                </div>

                <span className="mage-active-cover-rank">
                  {activeBook.rank}
                </span>

                <strong className="mage-active-cover-title">
                  {activeBook.title}
                </strong>

                <em className="mage-active-cover-author">
                  {activeBook.author}
                </em>

                <small className="mage-active-cover-category">
                  {activeBook.category}
                </small>
              </div>

              <div className="mage-active-book-main">
                <small>
                  CURRENT READING MISSION
                </small>

                <h2>
                  {activeBook.title}
                </h2>

                <p className="mage-book-author">
                  {activeBook.author}
                </p>

                <p>
                  {activeBook.why_it_matters ||
                  activeBook.description}
                </p>

                <div className="mage-reading-progress">
                  <div>
                    <span>
                      PROGRESS
                    </span>

                    <strong>
                      {Number(
                        activeProgress
                          ?.current_page ||
                        0
                      )}
                      {" / "}
                      {activeBook.estimated_pages ||
                        "?"}
                      {" PAGES"}
                    </strong>
                  </div>

                  <div className="mage-progress-track">
                    <i
                      style={{
                        width:
                          activePercent +
                          "%",
                      }}
                    />
                  </div>

                  <small>
                    {activePercent}% •{" "}
                    {Number(
                      activeProgress
                        ?.total_minutes ||
                      0
                    )}{" "}
                    MIN LOGGED
                  </small>
                </div>

                <div className="mage-reader-launch card3d">
                  <div>
                    <small>
                      ARCHIVE READER
                    </small>

                    <strong>
                      READ INSIDE THE SYSTEM
                    </strong>

                    <p>
                      Every Archive title opens a curated public-domain edition inside THE SYSTEM. The reader keeps your engaged time, page progress and notes together without sending you to a provider page.
                    </p>
                  </div>

                  <div className="mage-reader-launch-actions">
                    <button
                      type="button"
                      onClick={
                        openReader
                      }
                    >
                      READ NOW
                    </button>

                    <span
                      className={
                        "mage-reader-live-time " +
                        (
                          readerEngaged
                            ? "active"
                            : ""
                        )
                      }
                    >
                      <i />
                      {readerClock}
                    </span>
                  </div>
                </div>

                <div className="mage-reading-log-form">
                  <SystemField label="CURRENT PAGE">
                    <input
                      type="number"
                      min="0"
                      max={
                        activeBook.estimated_pages ||
                        undefined
                      }
                      value={
                        currentPage
                      }
                      onChange={(event) =>
                        setCurrentPage(
                          event.target.value
                        )
                      }
                      placeholder="PAGE"
                    />
                  </SystemField>

                  <SystemField label="MINUTES READ • ACTIVE READER AUTO-COUNTS">
                    <input
                      type="number"
                      min="1"
                      max="240"
                      value={
                        minutes
                      }
                      onChange={(event) =>
                        setMinutes(
                          event.target.value
                        )
                      }
                      placeholder="MIN"
                    />
                  </SystemField>
                </div>

                <SystemField label="SESSION NOTE • OPTIONAL">
                  <textarea
                    value={
                      readingNote
                    }
                    onChange={(event) =>
                      setReadingNote(
                        event.target.value
                      )
                    }
                    placeholder="One idea, quote in your own words, or what stood out today."
                  />
                </SystemField>

                <button
                  type="button"
                  className="mage-log-reading"
                  disabled={
                    Boolean(
                      busyAction
                    )
                  }
                  onClick={
                    logReading
                  }
                >
                  {busyAction ===
                  "log"
                    ? "RECORDING..."
                    : "LOG READING SESSION"}
                </button>

                <div className="mage-clear-book">
                  <small>
                    BOOK CLEAR REQUIREMENT
                  </small>

                  <strong>
                    REACH AT LEAST PAGE {clearThreshold} + FINAL REFLECTION
                  </strong>

                  <textarea
                    value={
                      reflection
                    }
                    onChange={(event) =>
                      setReflection(
                        event.target.value
                      )
                    }
                    placeholder="What did this book change in your thinking, behavior, health, discipline or money decisions?"
                  />

                  <button
                    type="button"
                    disabled={
                      Boolean(
                        busyAction
                      ) ||
                      !canClear ||
                      reflection
                        .trim()
                        .length <
                        20
                    }
                    onClick={
                      clearBook
                    }
                  >
                    {busyAction ===
                    "complete"
                      ? "VERIFYING BOOK..."
                      : canClear
                        ? "CLEAR BOOK"
                        : "BOOK STILL IN PROGRESS"}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="mage-archive-empty card3d">
              <span>
                ▤
              </span>

              <strong>
                NO ACTIVE BOOK
              </strong>

              <p>
                Choose one unlocked title below to begin your next reading mission.
              </p>
            </div>
          )}

          <SectionLabel
            number="II"
            title="ARCHIVE SHELVES"
          />

          <div className="mage-archive-controls card3d">
            <input
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
              placeholder="SEARCH TITLE, AUTHOR OR CATEGORY"
            />

            <select
              value={
                rankFilter
              }
              onChange={(event) =>
                setRankFilter(
                  event.target.value
                )
              }
            >
              <option value="ALL">
                ALL RANKS
              </option>

              {MAGE_ARCHIVE_RANKS.map(
                (rank) => (
                  <option
                    value={rank}
                    key={rank}
                  >
                    {rank}-RANK
                  </option>
                )
              )}
            </select>

            <select
              value={
                categoryFilter
              }
              onChange={(event) =>
                setCategoryFilter(
                  event.target.value
                )
              }
            >
              <option value="ALL">
                ALL CATEGORIES
              </option>

              {categories.map(
                (category) => (
                  <option
                    value={
                      category
                    }
                    key={
                      category
                    }
                  >
                    {category}
                  </option>
                )
              )}
            </select>
          </div>

          <div className="mage-book-grid">
            {filteredBooks.map(
              (book) => {
                const progress =
                  book.progress;

                const status =
                  progress?.status ||
                  "UNREAD";

                const percent =
                  progressPercent(
                    book
                  );

                const active =
                  status ===
                  "ACTIVE";

                const completed =
                  status ===
                  "COMPLETED";

                return (
                  <article
                    key={book.id}
                    data-rank={book.rank}
                    data-category={book.category}
                    className={
                      "mage-book-card card3d " +
                      (
                        !book.unlocked
                          ? "locked"
                          : active
                            ? "active"
                            : completed
                              ? "completed"
                              : ""
                      )
                    }
                  >
                    <div className="mage-book-card-head">
                      <span>
                        {book.rank}
                      </span>

                      <small>
                        {book.category}
                      </small>

                      {(book.featured ||
                        getSystemPublicDomainEdition(book)) && (
                        <b>
                          {getSystemPublicDomainEdition(book)
                            ? "READ INSIDE"
                            : "FEATURED"}
                        </b>
                      )}
                    </div>

                    <div className="mage-book-cover-face">
                      <div
                        className="mage-book-cover-crest"
                        aria-hidden="true"
                      >
                        <span>
                          {mageBookSigil(book.category)}
                        </span>
                      </div>

                      <div className="mage-book-cover-rule" />

                      <h3>
                        {book.title}
                      </h3>

                      <p className="mage-book-author">
                        {book.author}
                      </p>

                      <small className="mage-book-cover-mark">
                        {book.rank}-RANK • GRAND ARCHIVE
                      </small>
                    </div>

                    <p className="mage-book-description">
                      {book.description}
                    </p>

                    <div className="mage-book-meta">
                      <span>
                        DIFFICULTY {book.difficulty}/6
                      </span>

                      <span>
                        {book.estimated_pages
                          ? "~" +
                            book.estimated_pages +
                            " PAGES"
                          : "PAGE COUNT VARIES"}
                      </span>

                      <span>
                        +{book.xp_reward} XP
                      </span>
                    </div>

                    {progress && (
                      <div className="mage-card-progress">
                        <div>
                          <i
                            style={{
                              width:
                                percent +
                                "%",
                            }}
                          />
                        </div>

                        <small>
                          {status}
                          {" • "}
                          {Number(
                            progress.current_page ||
                            0
                          )}
                          {" PAGES"}
                        </small>
                      </div>
                    )}

                    <div className="mage-book-why">
                      <small>
                        WHY IT MATTERS
                      </small>

                      <p>
                        {book.why_it_matters}
                      </p>
                    </div>

                    {!book.unlocked ? (
                      <button
                        type="button"
                        disabled
                      >
                        🔒 {book.rank}-RANK LOCKED
                      </button>
                    ) : completed ? (
                      <button
                        type="button"
                        disabled
                        className="mage-book-cleared"
                      >
                        ✓ BOOK CLEARED
                      </button>
                    ) : active ? (
                      <button
                        type="button"
                        onClick={
                          openReader
                        }
                      >
                        READ NOW
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={
                          Boolean(
                            busyAction
                          )
                        }
                        onClick={() =>
                          startBook(
                            book,
                            {
                              openReaderAfterStart:
                                true,
                            }
                          )
                        }
                      >
                        {status ===
                        "PAUSED"
                          ? "RESUME READING"
                          : "READ NOW"}
                      </button>
                    )}
                  </article>
                );
              }
            )}
          </div>

          {filteredBooks.length ===
            0 && (
            <div className="mage-archive-empty card3d">
              <strong>
                NO BOOKS MATCH THIS FILTER
              </strong>
            </div>
          )}

          <SectionLabel
            number="III"
            title="COMPLETED ARCHIVE"
          />

          <div className="mage-completed-shelf">
            {completedBooks.length ? (
              completedBooks.map(
                (book) => (
                  <div
                    className="mage-completed-book card3d"
                    data-rank={book.rank}
                    key={
                      "complete-" +
                      book.id
                    }
                  >
                    <span className="mage-completed-book-seal">
                      <i aria-hidden="true">
                        {mageBookSigil(book.category)}
                      </i>
                      <b>
                        {book.rank}
                      </b>
                    </span>

                    <div>
                      <small>
                        {book.category}
                      </small>

                      <strong>
                        {book.title}
                      </strong>

                      <p>
                        {book.author}
                      </p>
                    </div>

                    <b>
                      ✓ CLEARED
                    </b>
                  </div>
                )
              )
            ) : (
              <div className="mage-archive-empty card3d">
                <strong>
                  YOUR FIRST CLEARED BOOK WILL APPEAR HERE.
                </strong>
              </div>
            )}
          </div>

          <p className="mage-edition-note">
            Page counts are approximate and can vary by edition. Log the page number in the copy you are actually reading.
          </p>
        </>
      )}

      {readerOpen &&
        activeBook && (
          <SystemModalPortal>
          <div
            className="mage-reader-overlay"
            role="dialog"
            aria-modal="true"
            aria-label={
              activeBook.title +
              " reader"
            }
          >
            <div className="mage-reader-shell">
              <header className="mage-reader-header">
                <div>
                  <small>
                    THE GRAND ARCHIVE // {activeBook.rank}-RANK
                  </small>

                  <strong>
                    {activeBook.title}
                  </strong>

                  <span>
                    {activeBook.author}
                  </span>
                </div>

                <div className="mage-reader-session">
                  <small>
                    ACTIVE READING
                  </small>

                  <strong>
                    {readerClock}
                  </strong>

                  <span
                    className={
                      readerEngaged
                        ? "engaged"
                        : "paused"
                    }
                  >
                    <i />
                    {readerEngaged
                      ? "COUNTING"
                      : "PAUSED • MOVE / SCROLL / TYPE TO RESUME"}
                  </span>
                </div>

                <button
                  type="button"
                  className="mage-reader-close"
                  onClick={
                    closeReader
                  }
                  aria-label="Close reader"
                >
                  ×
                </button>
              </header>

              <div className="mage-reader-toolbar">
                <label className="mage-reader-import">
                  <input
                    type="file"
                    accept="application/pdf,.pdf"
                    onChange={
                      importReaderPdf
                    }
                  />
                  <span>
                    {readerDocumentUrl
                      ? "CHANGE PDF"
                      : "IMPORT OWNED PDF"}
                  </span>
                </label>

                {onlineBook?.provider === "SYSTEM_PUBLIC_DOMAIN" &&
                  onlineBook?.direct_url && (
                    <a
                      className="mage-reader-source-link"
                      href={onlineBook.direct_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      SOURCE & LICENSE
                    </a>
                  )}

                <div className="mage-reader-page-control">
                  <button
                    type="button"
                    disabled={
                      !readerHasPageSurface
                    }
                    onClick={() =>
                      moveReaderPage(
                        -1
                      )
                    }
                  >
                    ←
                  </button>

                  <span>
                    {readerHasPageSurface
                      ? "PAGE"
                      : "PREPARING"}
                  </span>

                  <input
                    type="number"
                    min="1"
                    max={
                      readerPageLimit ===
                      Number.MAX_SAFE_INTEGER
                        ? undefined
                        : readerPageLimit
                    }
                    value={
                      resolvedReaderPageNumber
                    }
                    disabled={
                      !readerHasPageSurface
                    }
                    onChange={(event) => {
                      const next = Math.max(
                        1,
                        Math.min(
                          readerPageLimit,
                          Number(
                            event.target.value ||
                            1
                          ) ||
                            1
                        )
                      );

                      if (
                        next !==
                        resolvedReaderPageNumber
                      ) {
                        setReaderPageDirection(
                          next <
                          resolvedReaderPageNumber
                            ? "backward"
                            : "forward"
                        );
                        setReaderPageTurn(
                          (previous) =>
                            previous +
                            1
                        );
                      }

                      setCurrentPage(
                        String(next)
                      );
                      readerLastActivityRef.current =
                        Date.now();
                    }}
                  />

                  <button
                    type="button"
                    disabled={
                      !readerHasPageSurface
                    }
                    onClick={() =>
                      moveReaderPage(
                        1
                      )
                    }
                  >
                    →
                  </button>
                </div>

                <span className="mage-reader-file-name">
                  {readerDocumentName ||
                    (archiveReaderTextLoading
                      ? "PREPARING THE SYSTEM EDITION..."
                      : onlineBookLoading
                      ? "SEARCHING ONLINE ARCHIVE..."
                      : onlineBook?.provider === "SYSTEM_PUBLIC_DOMAIN"
                        ? onlineBook.edition_label ||
                          "THE SYSTEM NATIVE PUBLIC-DOMAIN READER"
                      : onlineBook?.pdf_url
                        ? "OPEN LIBRARY • PDF EDITION"
                        : onlineBookPdfLoading
                          ? "PREPARING OPEN LIBRARY PDF..."
                        : onlineBook?.provider === "CURATED_LEGAL_LINK"
                          ? "VERIFIED LEGAL EDITION"
                          : onlineBook?.provider === "OPEN_LIBRARY"
                        ? `OPEN LIBRARY • ${onlineBook.access_label || "READER LINK"}`
                        : onlineBook?.embeddable
                          ? `GOOGLE BOOKS • ${onlineBook.viewability || "PREVIEW"}`
                          : "NO READER SOURCE LOADED")}
                </span>
              </div>

              <main className="mage-reader-stage">
                <div
                  key={
                    "archive-page-" +
                    readerPageTurn +
                    "-" +
                    (
                      readerDocumentUrl ||
                      onlineBook?.pdf_url ||
                      onlineBook?.embed_url ||
                      onlineBook?.reader_key ||
                      "empty"
                    ) +
                    "-" +
                    resolvedReaderPageNumber
                  }
                  className={
                    "mage-reader-page-surface " +
                    (
                      readerPageTurn >
                      0
                        ? "is-turning " +
                          readerPageDirection
                        : ""
                    )
                  }
                >
                {readerDocumentUrl ? (
                  <iframe
                    title={
                      activeBook.title +
                      " PDF"
                    }
                    src={
                      readerDocumentSource
                    }
                  />
                ) : archiveReaderTextLoading ? (
                  <div className="mage-reader-online-loading">
                    <span>◌</span>
                    <small>THE SYSTEM EDITION</small>
                    <strong>PREPARING IN-APP PAGES...</strong>
                    <p>
                      THE SYSTEM is preparing the verified public-domain text as fixed Archive pages. No provider page will open.
                    </p>
                  </div>
                ) : readerHasNativeText ? (
                  <section
                    className="mage-reader-native-text"
                    aria-label={
                      activeBook.title +
                      " in-app text reader"
                    }
                  >
                    <article className="mage-reader-native-page">
                      <header>
                        <span>
                          THE SYSTEM ARCHIVE EDITION
                        </span>
                        <span>
                          {activeBook.category} • {activeBook.rank}-RANK
                        </span>
                      </header>

                      <div className="mage-reader-native-copy">
                        {archiveReaderPage
                          .split(/\n{2,}/)
                          .filter(Boolean)
                          .map((paragraph, index) => (
                            <p
                              key={
                                "archive-paragraph-" +
                                resolvedReaderPageNumber +
                                "-" +
                                index
                              }
                            >
                              {paragraph}
                            </p>
                          ))}
                      </div>

                      <footer>
                        <span>
                          VERIFIED PUBLIC-DOMAIN TEXT
                        </span>
                        <strong>
                          PAGE {resolvedReaderPageNumber} / {archiveReaderPages.length}
                        </strong>
                      </footer>
                    </article>
                  </section>
                ) : onlineBookPdfSource ? (
                  <div
                    className={
                      "mage-reader-online-source mage-reader-pdf-source " +
                      (
                        onlineBook?.provider === "SYSTEM_PUBLIC_DOMAIN"
                          ? "mage-reader-system-edition"
                          : ""
                      )
                    }
                  >
                    <iframe
                      title={activeBook.title + " embedded PDF reader"}
                      src={onlineBookPdfSource}
                      onLoad={() => {
                        setOnlineBookViewerReady(true);
                        setOnlineBookError("");
                        readerLastActivityRef.current = Date.now();
                      }}
                    />

                    <div className="mage-reader-online-badge">
                      <i className={onlineBookViewerReady ? "ready" : ""} />
                      <span>
                        {onlineBook?.provider === "SYSTEM_PUBLIC_DOMAIN"
                          ? "THE SYSTEM // PUBLIC-DOMAIN PDF"
                          : "OPEN LIBRARY / INTERNET ARCHIVE // PDF READER"}
                      </span>
                    </div>
                  </div>
                ) : onlineBook?.provider === "OPEN_LIBRARY" &&
                  onlineBook?.embeddable &&
                  onlineBook?.embed_url ? (
                  <div className="mage-reader-online-source">
                    <iframe
                      title={activeBook.title + " Open Library reader"}
                      src={onlineBook.embed_url}
                      allowFullScreen
                      onLoad={() => {
                        setOnlineBookViewerReady(true);
                        setOnlineBookError("");
                        readerLastActivityRef.current = Date.now();
                      }}
                      onError={() => {
                        setOnlineBookViewerReady(false);
                        setOnlineBook((previous) =>
                          previous
                            ? {
                                ...previous,
                                embeddable: false,
                                reader_mode: "OPEN_LIBRARY_RECORD",
                              }
                            : previous
                        );
                        setOnlineBookError(
                          "THE OPEN LIBRARY READER COULD NOT LOAD HERE. USE THE VERIFIED PROVIDER LINK BELOW."
                        );
                      }}
                    />

                    <div className="mage-reader-online-badge">
                      <i className={onlineBookViewerReady ? "ready" : ""} />
                      <span>
                        OPEN LIBRARY / INTERNET ARCHIVE // {onlineBookViewerReady ? "READER ONLINE" : "LOADING READER"}
                      </span>
                    </div>
                  </div>
                ) : onlineBook?.embeddable ? (
                  <div className="mage-reader-online-source">
                    <GoogleBooksEmbeddedViewer
                      volumeId={onlineBook.volume_id}
                      title={activeBook.title}
                      onReady={() => {
                        setOnlineBookViewerReady(true);
                        setOnlineBookError("");
                        readerLastActivityRef.current = Date.now();
                      }}
                      onFail={(reason) => {
                        setOnlineBookViewerReady(false);
                        setOnlineBook((previous) =>
                          previous
                            ? {
                                ...previous,
                                embeddable: false,
                                reader_mode: "METADATA_ONLY",
                              }
                            : previous
                        );
                        setOnlineBookError(
                          reason === "PREVIEW_UNAVAILABLE"
                            ? "THIS EDITION CANNOT BE PREVIEWED IN YOUR REGION. IMPORT YOUR OWNED PDF INSTEAD."
                            : "THE ONLINE BOOK VIEWER COULD NOT LOAD THIS EDITION."
                        );
                      }}
                    />

                    <div className="mage-reader-online-badge">
                      <i className={onlineBookViewerReady ? "ready" : ""} />
                      <span>
                        GOOGLE BOOKS // {onlineBookViewerReady ? "READER ONLINE" : "LOADING PREVIEW"}
                      </span>
                    </div>
                  </div>
                ) : onlineBookLoading ? (
                  <div className="mage-reader-online-loading">
                    <span>◌</span>
                    <small>ONLINE ARCHIVE SEARCH</small>
                    <strong>LOCATING A READABLE EDITION...</strong>
                    <p>
                      THE SYSTEM is matching this Archive title against Google Books and Open Library, then checking whether a legal reader is available.
                    </p>
                  </div>
                ) : (
                  <div className="mage-reader-empty">
                    <div
                      className="mage-reader-empty-book"
                      data-rank={
                        activeBook.rank
                      }
                    >
                      <span>
                        {mageBookSigil(
                          activeBook.category
                        )}
                      </span>

                      <small>
                        {activeBook.rank}-RANK
                      </small>

                      <strong>
                        {activeBook.title}
                      </strong>

                      <em>
                        {activeBook.author}
                      </em>
                    </div>

                    <div>
                      <small>
                        {onlineBook
                          ? "CURATED EDITION REQUIRED"
                          : "ARCHIVE CATALOG SYNC REQUIRED"}
                      </small>

                      <h3>
                        ARCHIVE EDITION UNAVAILABLE
                      </h3>

                      <p>
                        {archiveReaderTextError ||
                          onlineBookError ||
                          "THE SYSTEM could not load this curated Archive edition. Retry the catalog sync, or import a PDF you legally own while the source reconnects."}
                      </p>

                      {onlineBook && (
                        <div className="mage-reader-online-record">
                          {onlineBook.thumbnail && (
                            <img
                              src={onlineBook.thumbnail}
                              alt=""
                            />
                          )}
                          <div>
                            <small>
                              {onlineBook.provider === "CURATED_LEGAL_LINK"
                                ? "VERIFIED LEGAL EDITION"
                                : onlineBook.provider === "OPEN_LIBRARY"
                                  ? "OPEN LIBRARY RECORD"
                                  : "GOOGLE BOOKS RECORD"}
                            </small>
                            <strong>{onlineBook.title}</strong>
                            <span>{onlineBook.authors?.join(", ") || "UNKNOWN AUTHOR"}</span>
                            <em>
                              {onlineBook.availability_status ||
                                onlineBook.viewability ||
                                "NO EMBED"}
                            </em>
                          </div>
                        </div>
                      )}

                      <button
                        type="button"
                        className="mage-reader-retry-online"
                        onClick={
                          retryOnlineEdition
                        }
                      >
                        RETRY ARCHIVE SYNC
                      </button>

                      <label className="mage-reader-import large">
                        <input
                          type="file"
                          accept="application/pdf,.pdf"
                          onChange={
                            importReaderPdf
                          }
                        />
                        <span>
                          CHOOSE PDF
                        </span>
                      </label>
                    </div>
                  </div>
                )}
                </div>
              </main>

              <footer className="mage-reader-footer">
                <div>
                  <small>
                    ENGAGED TIME THIS SESSION
                  </small>

                  <strong>
                    {readerClock}
                  </strong>

                  <span>
                    {readerTrackedMinutes} FULL MINUTES
                  </span>
                </div>

                <textarea
                  value={
                    readingNote
                  }
                  onChange={(event) =>
                    setReadingNote(
                      event.target.value
                    )
                  }
                  placeholder="Capture one idea while you read..."
                />

                <button
                  type="button"
                  onClick={
                    closeReader
                  }
                >
                  SAVE TIME & RETURN TO GRIMOIRE
                </button>
              </footer>
            </div>
          </div>
          </SystemModalPortal>
        )}

    </div>
  );
}
