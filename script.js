/* =========================================================
   EXAM OMR — FINAL CLEAN VERSION
   ========================================================= */


/* =========================================================
   SUPABASE
   ========================================================= */

const SUPABASE_URL =
  "https://veanswqdgwffiespeokc.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_IuXKh35oKJiu3_a3HKurkw_YSURgtdT";

const supabaseClient =
  window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
  );


/* =========================================================
   CONSTANTS
   ========================================================= */

const STORAGE_BUCKET =
  "question-papers";

const OPTION_LABELS =
  ["A", "B", "C", "D"];

const PDFJS_VERSION =
  "4.10.38";

const PDFJS_CDN =
  `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.min.mjs`;

const PDFJS_WORKER_CDN =
  `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.mjs`;


/* =========================================================
   STATE
   ========================================================= */

let currentTest = null;
let currentPdfUrl = "";
let currentQuestionCount = 40;
let currentOptions = [];
let currentAnswerKey = [];
let selectedAnswers = [];
let testCreatedCode = "";
let candidateName = "";

let currentPdfDocument = null;
let currentPdfPage = 1;
let currentPdfScale = 1;
let pdfJsModule = null;
let pdfRendering = false;
let pdfRenderToken = 0;
let pendingPdfRender = null;


/* =========================================================
   DOM
   ========================================================= */

const $ = (id) =>
  document.getElementById(id);


function show(element) {
  if (element) {
    element.classList.remove(
      "hidden"
    );
  }
}


function hide(element) {
  if (element) {
    element.classList.add(
      "hidden"
    );
  }
}


function setLoading(
  visible,
  message = "Please wait..."
) {
  const overlay =
    $("loadingOverlay");

  const text =
    $("loadingText");

  if (text) {
    text.textContent =
      message;
  }

  if (visible) {
    show(overlay);
  } else {
    hide(overlay);
  }
}


function showStatus(
  element,
  message,
  type = ""
) {
  if (!element) {
    return;
  }

  element.textContent =
    message;

  element.className =
    "status-box";

  if (type) {
    element.classList.add(
      type
    );
  }

  show(element);
}


function hideStatus(element) {
  if (element) {
    hide(element);
  }
}


function showScreen(id) {
  document
    .querySelectorAll(".screen")
    .forEach(
      (screen) =>
        hide(screen)
    );

  const screen =
    $(id);

  if (screen) {
    show(screen);
  }

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}


function escapeHtml(value) {
  return String(
    value ?? ""
  )
    .replace(
      /&/g,
      "&amp;"
    )
    .replace(
      /</g,
      "&lt;"
    )
    .replace(
      />/g,
      "&gt;"
    )
    .replace(
      /"/g,
      "&quot;"
    )
    .replace(
      /'/g,
      "&#039;"
    );
}


/* =========================================================
   OPTIONS
   ========================================================= */

function normalizeOptionCount(
  value
) {
  return Number(value) === 2
    ? 2
    : 4;
}


function getOptionLabels(
  count
) {
  return OPTION_LABELS.slice(
    0,
    normalizeOptionCount(
      count
    )
  );
}


/* =========================================================
   TEST CODE
   ========================================================= */

function generateTestCode() {
  const characters =
    "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  let code = "";

  for (
    let i = 0;
    i < 6;
    i++
  ) {
    code +=
      characters[
        Math.floor(
          Math.random() *
            characters.length
        )
      ];
  }

  return code;
}


async function generateUniqueTestCode() {
  for (
    let attempt = 0;
    attempt < 10;
    attempt++
  ) {
    const code =
      generateTestCode();

    const {
      data,
      error
    } =
      await supabaseClient
        .from("tests")
        .select("id")
        .eq(
          "code",
          code
        )
        .limit(1);

    if (error) {
      throw error;
    }

    if (
      !data ||
      data.length === 0
    ) {
      return code;
    }
  }

  throw new Error(
    "Could not generate a unique test code."
  );
}


/* =========================================================
   CREATE — OPTION SETTINGS
   ========================================================= */

function renderOptionSettings() {
  const container =
    $("optionSettings");

  if (!container) {
    return;
  }

  const count =
    Math.max(
      1,
      Math.min(
        300,
        Number(
          $("questionCount")
            ?.value
        ) || 40
      )
    );

  const defaultCount =
    normalizeOptionCount(
      $("defaultOptions")
        ?.value
    );

  currentQuestionCount =
    count;

  container.innerHTML =
    "";

  for (
    let i = 1;
    i <= count;
    i++
  ) {
    const wrapper =
      document.createElement(
        "div"
      );

    wrapper.className =
      "option-setting";

    const number =
      document.createElement(
        "div"
      );

    number.className =
      "option-setting-number";

    number.textContent =
      i;

    const select =
      document.createElement(
        "select"
      );

    select.className =
      "question-option-count";

    select.dataset.question =
      String(i);

    select.innerHTML = `
      <option value="4">
        4 Options
      </option>

      <option value="2">
        2 Options
      </option>
    `;

    select.value =
      String(
        defaultCount
      );

    wrapper.appendChild(
      number
    );

    wrapper.appendChild(
      select
    );

    container.appendChild(
      wrapper
    );
  }
}


function collectQuestionOptions() {
  return Array.from(
    document.querySelectorAll(
      ".question-option-count"
    )
  ).map(
    (select) =>
      normalizeOptionCount(
        select.value
      )
  );
}


/* =========================================================
   PDF FILE SELECTION — CREATE SCREEN
   ========================================================= */

$("pdfFile")?.addEventListener(
  "change",
  (event) => {
    const file =
      event.target.files?.[0];

    const status =
      $("pdfStatus");

    const previewBox =
      $("pdfPreviewBox");

    const preview =
      $("pdfPreview");

    hide(previewBox);

    if (!file) {
      if (status) {
        status.textContent =
          "";
      }

      return;
    }

    if (
      file.type !==
      "application/pdf"
    ) {
      event.target.value =
        "";

      if (status) {
        status.textContent =
          "Please select a PDF file.";
      }

      return;
    }

    const url =
      URL.createObjectURL(
        file
      );

    if (preview) {
      preview.src =
        url;
    }

    show(previewBox);

    if (status) {
      status.textContent =
        `${file.name} selected.`;

      status.style.color =
        "#16a34a";
    }
  }
);


/* =========================================================
   PDF UPLOAD
   ========================================================= */

async function uploadQuestionPaper(
  file,
  code
) {
  if (!file) {
    throw new Error(
      "Please select a question paper PDF."
    );
  }

  const fileName =
    `${code}-${Date.now()}.pdf`;

  const {
    error
  } =
    await supabaseClient
      .storage
      .from(
        STORAGE_BUCKET
      )
      .upload(
        fileName,
        file,
        {
          cacheControl:
            "3600",
          upsert:
            false,
          contentType:
            "application/pdf"
        }
      );

  if (error) {
    throw error;
  }

  const {
    data
  } =
    supabaseClient
      .storage
      .from(
        STORAGE_BUCKET
      )
      .getPublicUrl(
        fileName
      );

  if (
    !data?.publicUrl
  ) {
    throw new Error(
      "Could not create PDF URL."
    );
  }

  return data.publicUrl;
}


/* =========================================================
   ANSWER KEY
   ========================================================= */

function renderAnswerKey() {
  const container =
    $("answerKeyGrid");

  if (!container) {
    return;
  }

  container.innerHTML =
    "";

  currentAnswerKey =
    new Array(
      currentQuestionCount
    ).fill("");

  for (
    let i = 0;
    i <
    currentQuestionCount;
    i++
  ) {
    const item =
      document.createElement(
        "div"
      );

    item.className =
      "answer-key-item";

    const title =
      document.createElement(
        "strong"
      );

    title.textContent =
      `Question ${i + 1}`;

    const select =
      document.createElement(
        "select"
      );

    select.className =
      "answer-key-select";

    select.dataset.question =
      String(i);

    const labels =
      getOptionLabels(
        currentOptions[i]
      );

    select.innerHTML =
      `
        <option value="">
          Select
        </option>
      ` +
      labels
        .map(
          (label) =>
            `
              <option value="${label}">
                ${label}
              </option>
            `
        )
        .join("");

    select.addEventListener(
      "change",
      () => {
        currentAnswerKey[i] =
          select.value;
      }
    );

    item.appendChild(
      title
    );

    item.appendChild(
      select
    );

    container.appendChild(
      item
    );
  }
}


function collectAnswerKey() {
  return Array.from(
    document.querySelectorAll(
      ".answer-key-select"
    )
  ).map(
    (select) =>
      select.value
  );
}


/* =========================================================
   CREATE TEST
   ========================================================= */

$("generateBtn")?.addEventListener(
  "click",
  async () => {
    const name =
      $("testName")
        ?.value
        ?.trim();

    const pdfFile =
      $("pdfFile")
        ?.files?.[0];

    const count =
      Number(
        $("questionCount")
          ?.value
      );

    if (!name) {
      alert(
        "Please enter a test name."
      );
      return;
    }

    if (!pdfFile) {
      alert(
        "Please select the question paper PDF."
      );
      return;
    }

    if (
      !Number.isInteger(
        count
      ) ||
      count < 1 ||
      count > 300
    ) {
      alert(
        "Question count must be between 1 and 300."
      );
      return;
    }

    currentQuestionCount =
      count;

    currentOptions =
      collectQuestionOptions();

    if (
      currentOptions.length !==
      count
    ) {
      renderOptionSettings();

      currentOptions =
        collectQuestionOptions();
    }

    setLoading(
      true,
      "Preparing your test..."
    );

    try {
      const code =
        await generateUniqueTestCode();

      setLoading(
        true,
        "Uploading question paper..."
      );

      currentPdfUrl =
        await uploadQuestionPaper(
          pdfFile,
          code
        );

      currentTest = {
        name,
        code,
        pdf_url:
          currentPdfUrl,
        question_count:
          currentQuestionCount,
        options:
          currentOptions
      };

      renderAnswerKey();

      showScreen(
        "answerKeyScreen"
      );
    } catch (error) {
      console.error(
        error
      );

      alert(
        "Could not prepare the test.\n\n" +
        error.message
      );
    } finally {
      setLoading(
        false
      );
    }
  }
);


/* =========================================================
   SAVE TEST
   ========================================================= */

$("saveTestBtn")?.addEventListener(
  "click",
  async () => {
    if (!currentTest) {
      alert(
        "No test is ready to save."
      );
      return;
    }

    const answerKey =
      collectAnswerKey();

    if (
      answerKey.length !==
      currentQuestionCount ||
      answerKey.some(
        (answer) => !answer
      )
    ) {
      alert(
        "Please select the correct answer for every question."
      );
      return;
    }

    const correctMark =
      Number(
        $("correctMark")
          ?.value
      );

    const wrongMark =
      Number(
        $("wrongMark")
          ?.value
      );

    if (
      !Number.isFinite(
        correctMark
      ) ||
      !Number.isFinite(
        wrongMark
      )
    ) {
      alert(
        "Please enter valid marks."
      );
      return;
    }

    setLoading(
      true,
      "Saving test..."
    );

    try {
      const {
        data,
        error
      } =
        await supabaseClient
          .from("tests")
          .insert({
            name:
              currentTest.name,

            pdf_url:
              currentTest.pdf_url,

            question_count:
              currentTest.question_count,

            options:
              currentTest.options,

            answer_key:
              answerKey,

            correct_mark:
              correctMark,

            wrong_mark:
              wrongMark,

            code:
              currentTest.code
          })
          .select()
          .single();

      if (error) {
        throw error;
      }

      testCreatedCode =
        data.code;

      if ($("createdCode")) {
        $("createdCode")
          .textContent =
          testCreatedCode;
      }

      showScreen(
        "createdScreen"
      );
    } catch (error) {
      console.error(
        error
      );

      alert(
        "Could not save the test.\n\n" +
        error.message
      );
    } finally {
      setLoading(
        false
      );
    }
  }
);


/* =========================================================
   LOAD TEST
   ========================================================= */

async function loadTestByCode(
  code
) {
  const cleanCode =
    code
      .trim()
      .toUpperCase();

  if (!cleanCode) {
    throw new Error(
      "Please enter the test code."
    );
  }

  const {
    data,
    error
  } =
    await supabaseClient
      .from("tests")
      .select("*")
      .eq(
        "code",
        cleanCode
      )
      .limit(1);

  if (error) {
    throw error;
  }

  if (
    !data ||
    data.length === 0
  ) {
    throw new Error(
      "Test not found. Please check the code."
    );
  }

  return data[0];
}


/* =========================================================
   CANDIDATE NAME
   ========================================================= */

function ensureCandidateNameInput() {
  if (
    $("candidateName")
  ) {
    return;
  }

  const examScreen =
    $("examScreen");

  const header =
    examScreen?.querySelector(
      ".exam-header"
    );

  if (!header) {
    return;
  }

  const wrapper =
    document.createElement(
      "div"
    );

  wrapper.className =
    "candidate-bar card";

  wrapper.innerHTML = `
    <div class="candidate-bar-info">
      <label>
        Candidate Name
      </label>

      <p>
        Enter your name before submitting the exam.
      </p>
    </div>

    <input
      id="candidateName"
      type="text"
      maxlength="100"
      autocomplete="name"
      placeholder="Enter your full name"
    >
  `;

  header.parentNode.insertBefore(
    wrapper,
    header.nextSibling
  );
}


/* =========================================================
   EXAM RENDER
   ========================================================= */

function renderExam() {
  const container =
    $("examGrid");

  if (!container) {
    return;
  }

  container.innerHTML =
    "";

  selectedAnswers =
    new Array(
      currentQuestionCount
    ).fill("");

  for (
    let i = 0;
    i <
    currentQuestionCount;
    i++
  ) {
    const row =
      document.createElement(
        "div"
      );

    row.className =
      "exam-question";

    const number =
      document.createElement(
        "div"
      );

    number.className =
      "question-number";

    number.textContent =
      i + 1;

    row.appendChild(
      number
    );

    const labels =
      getOptionLabels(
        currentOptions[i]
      );

    labels.forEach(
      (value) => {
        const label =
          document.createElement(
            "label"
          );

        label.className =
          "answer-option";

        const input =
          document.createElement(
            "input"
          );

        input.type =
          "radio";

        input.name =
          `question-${i}`;

        input.value =
          value;

        const text =
          document.createElement(
            "span"
          );

        text.textContent =
          value;

        input.addEventListener(
          "change",
          () => {
            selectedAnswers[i] =
              value;

            document
              .querySelectorAll(
                `input[name="question-${i}"]`
              )
              .forEach(
                (other) => {
                  other
                    .closest(
                      ".answer-option"
                    )
                    ?.classList.remove(
                      "selected"
                    );
                }
              );

            label.classList.add(
              "selected"
            );

            updateProgress();
          }
        );

        label.appendChild(
          input
        );

        label.appendChild(
          text
        );

        row.appendChild(
          label
        );
      }
    );

    container.appendChild(
      row
    );
  }

  updateProgress();
}


function updateProgress() {
  const answered =
    selectedAnswers.filter(
      Boolean
    ).length;

  const total =
    currentQuestionCount;

  const badge =
    $("questionProgress");

  if (badge) {
    badge.textContent =
      `${answered} / ${total}`;
  }

  const fill =
    document.querySelector(
      ".progress-fill"
    );

  if (fill) {
    fill.style.width =
      `${
        total
          ? (answered / total) * 100
          : 0
      }%`;
  }
}


/* =========================================================
   PDF.JS
   ========================================================= */

async function loadPdfJs() {
  if (pdfJsModule) {
    return pdfJsModule;
  }

  pdfJsModule =
    await import(
      PDFJS_CDN
    );

  pdfJsModule
    .GlobalWorkerOptions
    .workerSrc =
    PDFJS_WORKER_CDN;

  return pdfJsModule;
}


/* =========================================================
   PDF VIEWER CREATION
   ========================================================= */

function createPdfViewer() {
  let viewer =
    document.querySelector(
      "#pdfCanvasContainer"
    );

  if (viewer) {
    return viewer;
  }

  const oldIframe =
    $("examPdf");

  const host =
    oldIframe?.parentElement ||
    document.querySelector(
      ".pdf-card"
    );

  if (!host) {
    throw new Error(
      "PDF viewer area was not found."
    );
  }

  const wrapper =
    document.createElement(
      "div"
    );

  wrapper.className =
    "pdf-viewer";

  wrapper.innerHTML = `
    <div class="pdf-toolbar">

      <div class="pdf-toolbar-group">

        <button
          type="button"
          id="pdfPrevBtn"
          class="pdf-control"
        >
          ‹
        </button>

        <span
          id="pdfPageInfo"
          class="pdf-page-info"
        >
          0 / 0
        </span>

        <button
          type="button"
          id="pdfNextBtn"
          class="pdf-control"
        >
          ›
        </button>

      </div>

      <div class="pdf-toolbar-group">

        <button
          type="button"
          id="pdfZoomOutBtn"
          class="pdf-control"
        >
          −
        </button>

        <span
          id="pdfZoomValue"
          class="pdf-zoom-value"
        >
          100%
        </span>

        <button
          type="button"
          id="pdfZoomInBtn"
          class="pdf-control"
        >
          +
        </button>

      </div>

    </div>

    <div
      id="pdfCanvasContainer"
      class="pdf-canvas-container"
    >

      <div
        id="pdfLoading"
        class="pdf-loading"
      >
        Loading question paper...
      </div>

      <canvas
        id="pdfCanvas"
      ></canvas>

    </div>

    <div class="pdf-viewer-footer">
      <span>
        Question Paper
      </span>
    </div>
  `;

  /*
   * VERY IMPORTANT:
   * The old iframe is never used.
   */

  if (oldIframe) {
    oldIframe.style.display =
      "none";

    oldIframe.removeAttribute(
      "src"
    );

    oldIframe.setAttribute(
      "aria-hidden",
      "true"
    );
  }

  if (oldIframe) {
    oldIframe.parentNode.insertBefore(
      wrapper,
      oldIframe
    );
  } else {
    host.appendChild(
      wrapper
    );
  }

  viewer =
    wrapper.querySelector(
      "#pdfCanvasContainer"
    );

  viewer.style.touchAction =
    "pan-x pan-y";

  viewer.style.overflow =
    "auto";

  return viewer;
}


/* =========================================================
   PDF CONTROLS
   ========================================================= */

function bindPdfControls() {
  $("pdfPrevBtn")
    ?.addEventListener(
      "click",
      () => {
        if (
          currentPdfPage <= 1
        ) {
          return;
        }

        currentPdfPage--;

        renderPdfPage();
      }
    );

  $("pdfNextBtn")
    ?.addEventListener(
      "click",
      () => {
        if (
          !currentPdfDocument ||
          currentPdfPage >=
            currentPdfDocument.numPages
        ) {
          return;
        }

        currentPdfPage++;

        renderPdfPage();
      }
    );

  $("pdfZoomOutBtn")
    ?.addEventListener(
      "click",
      () => {
        currentPdfScale =
          Math.max(
            0.5,
            Math.round(
              (
                currentPdfScale -
                0.1
              ) * 100
            ) / 100
          );

        updatePdfZoom();

        renderPdfPage();
      }
    );

  $("pdfZoomInBtn")
    ?.addEventListener(
      "click",
      () => {
        currentPdfScale =
          Math.min(
            3,
            Math.round(
              (
                currentPdfScale +
                0.1
              ) * 100
            ) / 100
          );

        updatePdfZoom();

        renderPdfPage();
      }
    );
}


function updatePdfZoom() {
  const element =
    $("pdfZoomValue");

  if (element) {
    element.textContent =
      `${Math.round(
        currentPdfScale * 100
      )}%`;
  }
}


function updatePdfButtons() {
  const prev =
    $("pdfPrevBtn");

  const next =
    $("pdfNextBtn");

  if (prev) {
    prev.disabled =
      !currentPdfDocument ||
      currentPdfPage <= 1;
  }

  if (next) {
    next.disabled =
      !currentPdfDocument ||
      currentPdfPage >=
        currentPdfDocument.numPages;
  }
}


/* =========================================================
   INITIAL PDF SCALE
   ========================================================= */

async function getInitialPdfScale() {
  const container =
    $("pdfCanvasContainer");

  if (
    !container ||
    !currentPdfDocument
  ) {
    return 1;
  }

  const page =
    await currentPdfDocument.getPage(
      1
    );

  const viewport =
    page.getViewport({
      scale: 1
    });

  const width =
    Math.max(
      280,
      container.clientWidth - 30
    );

  return Math.max(
    0.5,
    Math.min(
      1.5,
      width /
        viewport.width
    )
  );
}


/* =========================================================
   PDF RENDER
   ========================================================= */

async function renderPdfPage() {
  if (
    !currentPdfDocument
  ) {
    return;
  }

  if (pdfRendering) {
    pendingPdfRender =
      true;

    return;
  }

  const canvas =
    $("pdfCanvas");

  const container =
    $("pdfCanvasContainer");

  if (
    !canvas ||
    !container
  ) {
    return;
  }

  pdfRendering =
    true;

  const token =
    pdfRenderToken;

  try {
    const page =
      await currentPdfDocument.getPage(
        currentPdfPage
      );

    if (
      token !== pdfRenderToken
    ) {
      return;
    }

    const viewport =
      page.getViewport({
        scale:
          currentPdfScale
      });

    const ratio =
      Math.min(
        window.devicePixelRatio ||
          1,
        2
      );

    canvas.width =
      Math.floor(
        viewport.width *
          ratio
      );

    canvas.height =
      Math.floor(
        viewport.height *
          ratio
      );

    canvas.style.width =
      `${viewport.width}px`;

    canvas.style.height =
      `${viewport.height}px`;

    const context =
      canvas.getContext(
        "2d"
      );

    context.setTransform(
      ratio,
      0,
      0,
      ratio,
      0,
      0
    );

    await page.render({
      canvasContext:
        context,
      viewport
    }).promise;

    if (
      token !== pdfRenderToken
    ) {
      return;
    }

    canvas.style.display =
      "block";

    hide(
      $("pdfLoading")
    );

    const pageInfo =
      $("pdfPageInfo");

    if (pageInfo) {
      pageInfo.textContent =
        `${currentPdfPage} / ${currentPdfDocument.numPages}`;
    }

    updatePdfButtons();
    updatePdfZoom();
  } catch (error) {
    console.error(
      "PDF render error:",
      error
    );

    const loading =
      $("pdfLoading");

    if (loading) {
      loading.innerHTML = `
        <strong>
          Could not display this page
        </strong>

        <span>
          Please try again.
        </span>
      `;

      show(loading);
    }
  } finally {
    pdfRendering =
      false;

    if (
      pendingPdfRender
    ) {
      pendingPdfRender =
        false;

      requestAnimationFrame(
        () => {
          renderPdfPage();
        }
      );
    }
  }
}


/* =========================================================
   OPEN PDF
   ========================================================= */

async function initializePdfViewer(
  url
) {
  if (!url) {
    throw new Error(
      "Question paper URL is missing."
    );
  }

  createPdfViewer();

  currentPdfUrl =
    url;

  pdfRenderToken++;

  currentPdfDocument =
    null;

  currentPdfPage =
    1;

  currentPdfScale =
    1;

  const loading =
    $("pdfLoading");

  if (loading) {
    loading.textContent =
      "Loading question paper...";

    show(loading);
  }

  const pdfjsLib =
    await loadPdfJs();

  currentPdfDocument =
    await pdfjsLib
      .getDocument({
        url,
        withCredentials:
          false,
        disableAutoFetch:
          false,
        disableStream:
          false
      })
      .promise;

  /*
   * IMPORTANT:
   * At this point the exam screen is already visible.
   * Therefore container.clientWidth is real.
   */

  currentPdfScale =
    await getInitialPdfScale();

  updatePdfZoom();

  updatePdfButtons();

  await renderPdfPage();
}


/* =========================================================
   JOIN TEST
   ========================================================= */

async function joinTest() {
  const code =
    $("joinCode")
      ?.value
      ?.trim()
      .toUpperCase();

  const status =
    $("joinStatus");

  hideStatus(status);

  if (!code) {
    showStatus(
      status,
      "Please enter the test code.",
      "error"
    );

    return;
  }

  if (code.length !== 6) {
    showStatus(
      status,
      "Test code must contain 6 characters.",
      "error"
    );

    return;
  }

  setLoading(
    true,
    "Loading test..."
  );

  try {
    const test =
      await loadTestByCode(
        code
      );

    currentTest =
      test;

    currentQuestionCount =
      Number(
        test.question_count
      );

    currentOptions =
      Array.isArray(
        test.options
      )
        ? test.options.map(
            normalizeOptionCount
          )
        : new Array(
            currentQuestionCount
          ).fill(4);

    currentAnswerKey =
      Array.isArray(
        test.answer_key
      )
        ? test.answer_key
        : [];

    selectedAnswers =
      new Array(
        currentQuestionCount
      ).fill("");

    candidateName =
      "";

    currentPdfUrl =
      test.pdf_url;

    if ($("examName")) {
      $("examName")
        .textContent =
        test.name;
    }

    if ($("examInfo")) {
      $("examInfo")
        .textContent =
        `${currentQuestionCount} Questions • Code: ${test.code}`;
    }

    /*
     * First show the exam screen.
     *
     * This is the critical fix.
     */

    showScreen(
      "examScreen"
    );

    ensureCandidateNameInput();

    const nameInput =
      $("candidateName");

    if (nameInput) {
      nameInput.value =
        "";
    }

    renderExam();

    /*
     * Wait for browser layout.
     */

    await new Promise(
      (resolve) =>
        requestAnimationFrame(
          () =>
            requestAnimationFrame(
              resolve
            )
        )
    );

    /*
     * NOW load PDF.
     *
     * The viewer is no longer inside
     * a hidden screen.
     */

    await initializePdfViewer(
      currentPdfUrl
    );
  } catch (error) {
    console.error(
      "Join test error:",
      error
    );

    showStatus(
      status,
      error.message ||
        "Could not load the test.",
      "error"
    );
  } finally {
    setLoading(
      false
    );
  }
}


/* =========================================================
   RESET ANSWERS
   ========================================================= */

$("resetExamBtn")
  ?.addEventListener(
    "click",
    () => {
      if (
        !confirm(
          "Delete all selected answers?"
        )
      ) {
        return;
      }

      selectedAnswers =
        new Array(
          currentQuestionCount
        ).fill("");

      document
        .querySelectorAll(
          ".answer-option input"
        )
        .forEach(
          (input) => {
            input.checked =
              false;

            input
              .closest(
                ".answer-option"
              )
              ?.classList.remove(
                "selected"
              );
          }
        );

      hide(
        $("resultBox")
      );

      updateProgress();
    }
  );


/* =========================================================
   RESULT
   ========================================================= */

function calculateResult() {
  const answerKey =
    Array.isArray(
      currentTest.answer_key
    )
      ? currentTest.answer_key
      : [];

  const correctMark =
    Number(
      currentTest.correct_mark
    ) || 0;

  const wrongMark =
    Number(
      currentTest.wrong_mark
    ) || 0;

  let correct = 0;
  let wrong = 0;
  let unanswered = 0;

  for (
    let i = 0;
    i <
    currentQuestionCount;
    i++
  ) {
    const selected =
      selectedAnswers[i];

    if (!selected) {
      unanswered++;
      continue;
    }

    if (
      selected ===
      answerKey[i]
    ) {
      correct++;
    } else {
      wrong++;
    }
  }

  const score =
    (
      correct *
      correctMark
    ) -
    (
      wrong *
      Math.abs(
        wrongMark
      )
    );

  const totalMarks =
    currentQuestionCount *
    correctMark;

  const percentage =
    totalMarks > 0
      ? (
          score /
          totalMarks
        ) * 100
      : 0;

  return {
    candidateName,
    testCode:
      currentTest.code,
    testName:
      currentTest.name,
    correct,
    wrong,
    unanswered,
    score,
    totalMarks,
    percentage
  };
}


async function saveExamResult(
  result
) {
  const {
    error
  } =
    await supabaseClient
      .from(
        "exam_results"
      )
      .insert({
        test_code:
          result.testCode,

        test_name:
          result.testName,

        candidate_name:
          result.candidateName,

        correct:
          result.correct,

        wrong:
          result.wrong,

        unanswered:
          result.unanswered,

        score:
          result.score,

        total_marks:
          result.totalMarks,

        percentage:
          result.percentage
      });

  if (error) {
    throw error;
  }
}


function formatNumber(
  number
) {
  return Number(
    number
  )
    .toFixed(2)
    .replace(
      /\.00$/,
      ""
    );
}


function renderResult(
  result
) {
  const box =
    $("resultBox");

  if (!box) {
    return;
  }

  box.innerHTML = `
    <div class="result-title">
      Result
    </div>

    <p>
      ${escapeHtml(
        result.candidateName
      )}
      •
      ${escapeHtml(
        result.testName
      )}
    </p>

    <div class="result-stats">

      <div class="result-stat">
        <span>Correct</span>
        <strong>
          ${result.correct}
        </strong>
      </div>

      <div class="result-stat">
        <span>Wrong</span>
        <strong>
          ${result.wrong}
        </strong>
      </div>

      <div class="result-stat">
        <span>Unanswered</span>
        <strong>
          ${result.unanswered}
        </strong>
      </div>

      <div class="result-stat">
        <span>Percentage</span>
        <strong>
          ${result.percentage.toFixed(2)}%
        </strong>
      </div>

    </div>

    <div class="score-display">
      <span>Score</span>

      <strong>
        ${formatNumber(
          result.score
        )}
        /
        ${formatNumber(
          result.totalMarks
        )}
      </strong>
    </div>
  `;

  show(box);

  box.scrollIntoView({
    behavior:
      "smooth",
    block:
      "nearest"
  });
}


/* =========================================================
   SUBMIT
   ========================================================= */

$("submitExamBtn")
  ?.addEventListener(
    "click",
    async () => {
      if (!currentTest) {
        return;
      }

      const input =
        $("candidateName");

      candidateName =
        input?.value
          ?.trim() || "";

      if (!candidateName) {
        alert(
          "Please enter your name before submitting the exam."
        );

        input?.focus();

        return;
      }

      const unanswered =
        selectedAnswers.filter(
          (answer) => !answer
        ).length;

      if (
        unanswered > 0 &&
        !confirm(
          `${unanswered} question(s) are unanswered.\n\nSubmit anyway?`
        )
      ) {
        return;
      }

      setLoading(
        true,
        "Checking your answers..."
      );

      try {
        const result =
          calculateResult();

        try {
          await saveExamResult(
            result
          );
        } catch (saveError) {
          console.warn(
            "Result save failed:",
            saveError
          );
        }

        renderResult(
          result
        );
      } finally {
        setLoading(
          false
        );
      }
    }
  );


/* =========================================================
   COPY CODE
   ========================================================= */

$("copyCodeBtn")
  ?.addEventListener(
    "click",
    async () => {
      const code =
        $("createdCode")
          ?.textContent
          ?.trim();

      if (!code) {
        return;
      }

      try {
        await navigator
          .clipboard
          .writeText(
            code
          );

        const button =
          $("copyCodeBtn");

        if (button) {
          const old =
            button.textContent;

          button.textContent =
            "Copied ✓";

          setTimeout(
            () => {
              button.textContent =
                old;
            },
            1500
          );
        }
      } catch {
        alert(
          `Test Code: ${code}`
        );
      }
    }
  );


/* =========================================================
   EXIT EXAM
   ========================================================= */

$("exitExamBtn")
  ?.addEventListener(
    "click",
    async () => {
      const answered =
        selectedAnswers.filter(
          Boolean
        ).length;

      if (
        answered > 0 &&
        !confirm(
          "You have selected some answers.\n\nExit the exam?"
        )
      ) {
        return;
      }

      pdfRenderToken++;

      if (
        currentPdfDocument
      ) {
        try {
          await currentPdfDocument.destroy();
        } catch {}
      }

      currentPdfDocument =
        null;

      currentPdfUrl =
        "";

      selectedAnswers =
        [];

      candidateName =
        "";

      currentTest =
        null;

      showScreen(
        "homeScreen"
      );
    }
  );


/* =========================================================
   HOME
   ========================================================= */

$("showCreateBtn")
  ?.addEventListener(
    "click",
    () => {
      showScreen(
        "createScreen"
      );

      renderOptionSettings();
    }
  );


$("showJoinBtn")
  ?.addEventListener(
    "click",
    () => {
      showScreen(
        "joinScreen"
      );

      $("joinCode")
        ?.focus();
    }
  );


$("backHomeFromCreate")
  ?.addEventListener(
    "click",
    () => {
      showScreen(
        "homeScreen"
      );
    }
  );


$("backHomeFromJoin")
  ?.addEventListener(
    "click",
    () => {
      showScreen(
        "homeScreen"
      );
    }
  );


$("goHomeAfterCreate")
  ?.addEventListener(
    "click",
    () => {
      showScreen(
        "homeScreen"
      );
    }
  );


$("backToCreateBtn")
  ?.addEventListener(
    "click",
    () => {
      showScreen(
        "createScreen"
      );
    }
  );


/* =========================================================
   CLEAR
   ========================================================= */

$("clearCreateBtn")
  ?.addEventListener(
    "click",
    () => {
      $("testName").value =
        "";

      $("pdfFile").value =
        "";

      $("questionCount").value =
        "40";

      $("defaultOptions").value =
        "4";

      $("pdfStatus").textContent =
        "";

      hide(
        $("pdfPreviewBox")
      );

      currentTest =
        null;

      currentPdfUrl =
        "";

      currentOptions =
        [];

      currentAnswerKey =
        [];

      renderOptionSettings();
    }
  );


/* =========================================================
   SETTINGS
   ========================================================= */

$("questionCount")
  ?.addEventListener(
    "change",
    () => {
      renderOptionSettings();
    }
  );


$("defaultOptions")
  ?.addEventListener(
    "change",
    () => {
      const value =
        normalizeOptionCount(
          $("defaultOptions")
            .value
        );

      document
        .querySelectorAll(
          ".question-option-count"
        )
        .forEach(
          (select) => {
            select.value =
              String(value);
          }
        );
    }
  );


/* =========================================================
   JOIN CODE
   ========================================================= */

$("joinCode")
  ?.addEventListener(
    "input",
    (event) => {
      event.target.value =
        event.target.value
          .toUpperCase()
          .replace(
            /[^A-Z0-9]/g,
            ""
          )
          .slice(
            0,
            6
          );
    }
  );


$("joinCode")
  ?.addEventListener(
    "keydown",
    (event) => {
      if (
        event.key ===
        "Enter"
      ) {
        event.preventDefault();

        $("joinBtn")
          ?.click();
      }
    }
  );


$("joinBtn")
  ?.addEventListener(
    "click",
    joinTest
  );


/* =========================================================
   PDF KEYBOARD CONTROLS
   ========================================================= */

document.addEventListener(
  "keydown",
  (event) => {
    if (
      !currentPdfDocument
    ) {
      return;
    }

    const tag =
      event.target?.tagName;

    if (
      tag === "INPUT" ||
      tag === "TEXTAREA" ||
      tag === "SELECT"
    ) {
      return;
    }

    if (
      event.key ===
      "ArrowLeft"
    ) {
      if (
        currentPdfPage > 1
      ) {
        currentPdfPage--;

        renderPdfPage();
      }
    }

    if (
      event.key ===
      "ArrowRight"
    ) {
      if (
        currentPdfPage <
        currentPdfDocument.numPages
      ) {
        currentPdfPage++;

        renderPdfPage();
      }
    }

    if (
      event.key ===
      "+"
    ) {
      currentPdfScale =
        Math.min(
          3,
          currentPdfScale +
            0.1
        );

      updatePdfZoom();

      renderPdfPage();
    }

    if (
      event.key ===
      "-"
    ) {
      currentPdfScale =
        Math.max(
          0.5,
          currentPdfScale -
            0.1
        );

      updatePdfZoom();

      renderPdfPage();
    }
  }
);


/* =========================================================
   PDF RESIZE
   ========================================================= */

let resizeTimer =
  null;

window.addEventListener(
  "resize",
  () => {
    clearTimeout(
      resizeTimer
    );

    resizeTimer =
      setTimeout(
        () => {
          if (
            currentPdfDocument
          ) {
            renderPdfPage();
          }
        },
        200
      );
  }
);


/* =========================================================
   MOBILE SWIPE
   ========================================================= */

let touchStartX = 0;
let touchStartY = 0;

document.addEventListener(
  "touchstart",
  (event) => {
    const viewer =
      event.target.closest?.(
        "#pdfCanvasContainer"
      );

    if (!viewer) {
      return;
    }

    const touch =
      event.touches?.[0];

    if (!touch) {
      return;
    }

    touchStartX =
      touch.clientX;

    touchStartY =
      touch.clientY;
  },
  {
    passive: true
  }
);


document.addEventListener(
  "touchend",
  (event) => {
    if (
      !currentPdfDocument
    ) {
      return;
    }

    const viewer =
      event.target.closest?.(
        "#pdfCanvasContainer"
      );

    if (!viewer) {
      return;
    }

    const touch =
      event.changedTouches?.[0];

    if (!touch) {
      return;
    }

    const dx =
      touch.clientX -
      touchStartX;

    const dy =
      touch.clientY -
      touchStartY;

    if (
      Math.abs(dx) < 70 ||
      Math.abs(dx) <=
        Math.abs(dy)
    ) {
      return;
    }

    if (dx < 0) {
      if (
        currentPdfPage <
        currentPdfDocument.numPages
      ) {
        currentPdfPage++;

        renderPdfPage();
      }
    } else {
      if (
        currentPdfPage > 1
      ) {
        currentPdfPage--;

        renderPdfPage();
      }
    }
  },
  {
    passive: true
  }
);


/* =========================================================
   INITIALIZATION
   ========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  () => {
    renderOptionSettings();

    /*
     * Create the PDF viewer structure
     * only when the exam screen needs it.
     *
     * No PDF iframe is activated.
     */

    showScreen(
      "homeScreen"
    );
  },
  {
    once: true
  }
);


/* =========================================================
   GLOBAL ERROR LOG
   ========================================================= */

window.addEventListener(
  "unhandledrejection",
  (event) => {
    console.error(
      "Unhandled error:",
      event.reason
    );
  }
);


console.log(
  "✓ Exam OMR — Final Clean Script Loaded"
);