/* =========================================================
   EXAM OMR
   FINAL REBUILT SCRIPT
   Android + Desktop PDF Viewer
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

const OPTION_LABELS = [
  "A",
  "B",
  "C",
  "D"
];


/* =========================================================
   PDF.JS
   ========================================================= */

/*
   IMPORTANT

   We are intentionally using the classic PDF.js build
   instead of the previous dynamic .mjs build.

   This is much more reliable on:
   - Android Chrome
   - Android WebView
   - Desktop Chrome
   - Edge
   - Firefox

   The PDF itself is fetched as binary data first.
   PDF.js then renders that binary data locally.

   This avoids the previous direct remote-URL loading
   problem.
*/

const PDFJS_VERSION =
  "3.11.174";

const PDFJS_MAIN_CDN =
  `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.min.js`;

const PDFJS_WORKER_CDN =
  `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.js`;


/* =========================================================
   STATE
   ========================================================= */

let currentTest = null;

let currentPdfUrl = "";

let currentQuestionCount = 40;

let currentOptions = [];

let currentAnswerKey = [];

let selectedAnswers = [];

let candidateName = "";

let testCreatedCode = "";


/* =========================================================
   PDF STATE
   ========================================================= */

let pdfJsLoaded = false;

let currentPdfDocument = null;

let currentPdfLoadingTask = null;

let currentPdfPage = 1;

let currentPdfScale = 1;

let pdfRendering = false;

let pdfRenderQueued = false;

let pdfRenderToken = 0;

let pdfTouchStartX = 0;

let pdfTouchStartY = 0;

let pdfResizeTimer = null;


/* =========================================================
   DOM HELPER
   ========================================================= */

const $ = (id) =>
  document.getElementById(id);


/* =========================================================
   BASIC UI HELPERS
   ========================================================= */

function show(element) {
  if (!element) {
    return;
  }

  element.classList.remove(
    "hidden"
  );
}


function hide(element) {
  if (!element) {
    return;
  }

  element.classList.add(
    "hidden"
  );
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
  if (!element) {
    return;
  }

  hide(element);
}


/* =========================================================
   SCREEN NAVIGATION
   ========================================================= */

function showScreen(
  screenId
) {
  document
    .querySelectorAll(
      ".screen"
    )
    .forEach(
      (screen) => {
        hide(screen);
      }
    );

  const target =
    $(screenId);

  if (target) {
    show(target);
  }

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}


/* =========================================================
   HTML ESCAPE
   ========================================================= */

function escapeHtml(
  value
) {
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
   OPTION HELPERS
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
    attempt < 15;
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
   CREATE TEST
   OPTION SETTINGS
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
   CREATE SCREEN
   PDF LOCAL PREVIEW
   ========================================================= */

$("pdfFile")
  ?.addEventListener(
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

      hide(
        previewBox
      );

      if (preview) {
        preview.src =
          "";
      }

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

      const localUrl =
        URL.createObjectURL(
          file
        );

      if (preview) {
        preview.src =
          localUrl;
      }

      show(
        previewBox
      );

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

$("generateBtn")
  ?.addEventListener(
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

$("saveTestBtn")
  ?.addEventListener(
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
          (answer) =>
            !answer
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

        if (
          $("createdCode")
        ) {
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


/* =========================================================
   PROGRESS
   ========================================================= */

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
          ? (
              answered /
              total
            ) *
            100
          : 0
      }%`;
  }
}
 
/* =========================================================
   PDF.JS LOADER
   ========================================================= */

/*
   Load the classic PDF.js browser build dynamically.

   We are NOT using dynamic ES-module import here.

   Reason:
   The previous implementation depended on a remote
   .mjs module and worker pair. That can fail on some
   Android browsers / WebViews.

   This version loads the normal browser build and then
   uses PDF.js with binary PDF data.
*/

async function loadPdfJs() {

  if (
    window.pdfjsLib
  ) {
    pdfJsLoaded =
      true;

    window.pdfjsLib
      .GlobalWorkerOptions
      .workerSrc =
      PDFJS_WORKER_CDN;

    return window.pdfjsLib;
  }


  if (
    pdfJsLoaded
  ) {
    if (
      window.pdfjsLib
    ) {
      return window.pdfjsLib;
    }
  }


  const existingScript =
    document.querySelector(
      'script[data-pdfjs="true"]'
    );


  if (
    existingScript
  ) {

    await new Promise(
      (
        resolve,
        reject
      ) => {

        const timeout =
          setTimeout(
            () => {
              reject(
                new Error(
                  "PDF.js loading timed out."
                )
              );
            },
            20000
          );


        existingScript.addEventListener(
          "load",
          () => {
            clearTimeout(
              timeout
            );

            resolve();
          },
          {
            once: true
          }
        );


        existingScript.addEventListener(
          "error",
          () => {
            clearTimeout(
              timeout
            );

            reject(
              new Error(
                "Could not load PDF.js."
              )
            );
          },
          {
            once: true
          }
        );

      }
    );

  } else {

    await new Promise(
      (
        resolve,
        reject
      ) => {

        const script =
          document.createElement(
            "script"
          );

        script.src =
          PDFJS_MAIN_CDN;

        script.async =
          true;

        script.dataset.pdfjs =
          "true";


        script.onload =
          () => {
            resolve();
          };


        script.onerror =
          () => {
            reject(
              new Error(
                "Could not load the PDF viewer library."
              )
            );
          };


        document.head.appendChild(
          script
        );

      }
    );

  }


  if (
    !window.pdfjsLib
  ) {

    throw new Error(
      "PDF.js loaded but was not initialized."
    );

  }


  window.pdfjsLib
    .GlobalWorkerOptions
    .workerSrc =
    PDFJS_WORKER_CDN;


  pdfJsLoaded =
    true;


  return window.pdfjsLib;
}


/* =========================================================
   FETCH PDF AS BINARY DATA
   ========================================================= */

/*
   IMPORTANT

   The Supabase public URL is fetched first.

   PDF.js receives Uint8Array data instead of the remote
   URL itself.

   This avoids PDF.js having to perform the remote request
   internally.
*/

async function fetchPdfData(
  url
) {

  if (!url) {

    throw new Error(
      "Question paper URL is missing."
    );

  }


  let response;


  try {

    response =
      await fetch(
        url,
        {
          method:
            "GET",

          mode:
            "cors",

          credentials:
            "omit",

          cache:
            "no-store",

          redirect:
            "follow"
        }
      );

  } catch (
    networkError
  ) {

    console.error(
      "PDF fetch network error:",
      networkError
    );

    throw new Error(
      "The question paper could not be downloaded from storage."
    );

  }


  if (
    !response.ok
  ) {

    throw new Error(
      `Question paper download failed (${response.status}).`
    );

  }


  const contentType =
    (
      response.headers
        .get(
          "content-type"
        ) || ""
    ).toLowerCase();


  /*
     Some storage servers may return an empty or generic
     content-type. Therefore we do NOT reject the file
     only because content-type is not application/pdf.
  */

  if (
    contentType &&
    !contentType.includes(
      "pdf"
    ) &&
    !contentType.includes(
      "octet-stream"
    )
  ) {

    console.warn(
      "Unexpected PDF content type:",
      contentType
    );

  }


  const buffer =
    await response.arrayBuffer();


  if (
    !buffer ||
    buffer.byteLength < 100
  ) {

    throw new Error(
      "The downloaded question paper is empty or invalid."
    );

  }


  /*
     PDF files normally begin with %PDF.
     We check this so an HTML error page from storage
     does not get passed to PDF.js.
  */

  const firstBytes =
    new Uint8Array(
      buffer.slice(
        0,
        5
      )
    );


  const signature =
    String.fromCharCode(
      ...firstBytes
    );


  if (
    signature !==
    "%PDF-"
  ) {

    console.error(
      "Invalid PDF signature:",
      signature
    );

    throw new Error(
      "The downloaded file is not a valid PDF."
    );

  }


  return new Uint8Array(
    buffer
  );
}


/* =========================================================
   PDF VIEWER
   ========================================================= */

function createPdfViewer() {

  const pdfCard =
    document.querySelector(
      "#examScreen .pdf-card"
    );


  if (!pdfCard) {

    throw new Error(
      "PDF viewer area was not found."
    );

  }


  /*
     Remove any viewer created by an earlier
     attempt.

     This only removes browser UI.

     It does NOT delete:
     - questions
     - tests
     - results
     - Supabase files
  */

  pdfCard
    .querySelectorAll(
      ".pdf-viewer"
    )
    .forEach(
      (
        viewer
      ) => {
        viewer.remove();
      }
    );


  /*
     Remove any old iframe if an older HTML version
     is still cached by the browser.
  */

  pdfCard
    .querySelectorAll(
      "iframe"
    )
    .forEach(
      (
        iframe
      ) => {
        iframe.remove();
      }
    );


  /*
     Remove old runtime PDF elements.
  */

  pdfCard
    .querySelectorAll(
      [
        "#pdfCanvasContainer",
        "#pdfCanvas",
        "#pdfLoading",
        "#pdfPrevBtn",
        "#pdfNextBtn",
        "#pdfZoomInBtn",
        "#pdfZoomOutBtn",
        "#pdfPageInfo",
        "#pdfZoomValue"
      ].join(
        ","
      )
    )
    .forEach(
      (
        element
      ) => {

        element.remove();

      }
    );


  const footer =
    pdfCard.querySelector(
      ".pdf-footer"
    );


  const viewer =
    document.createElement(
      "div"
    );


  viewer.className =
    "pdf-viewer";


  viewer.innerHTML = `

    <!-- ================================================
         PDF TOOLBAR
         ================================================ -->

    <div
      class="pdf-toolbar"
    >

      <div
        class="pdf-toolbar-group"
      >

        <button
          type="button"
          id="pdfPrevBtn"
          class="pdf-control"
          aria-label="Previous page"
          title="Previous page"
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
          aria-label="Next page"
          title="Next page"
        >
          ›
        </button>

      </div>


      <div
        class="pdf-toolbar-group"
      >

        <button
          type="button"
          id="pdfZoomOutBtn"
          class="pdf-control"
          aria-label="Zoom out"
          title="Zoom out"
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
          aria-label="Zoom in"
          title="Zoom in"
        >
          +
        </button>

      </div>

    </div>


    <!-- ================================================
         PDF CANVAS
         ================================================ -->

    <div
      id="pdfCanvasContainer"
      class="pdf-canvas-container"
    >

      <div
        id="pdfLoading"
        class="pdf-loading"
      >

        <strong>
          Loading question paper...
        </strong>

        <span>
          Please wait
        </span>

      </div>


      <canvas
        id="pdfCanvas"
      ></canvas>

    </div>


    <!-- ================================================
         VIEWER FOOTER
         ================================================ -->

    <div
      class="pdf-viewer-footer"
    >

      <span>
        Question Paper
      </span>

    </div>

  `;


  /*
     Put our ONE viewer immediately before
     the normal card footer.
  */

  if (
    footer
  ) {

    pdfCard.insertBefore(
      viewer,
      footer
    );

  } else {

    pdfCard.appendChild(
      viewer
    );

  }


  const container =
    $("pdfCanvasContainer");


  if (
    container
  ) {

    /*
       Android touch scrolling.
    */

    container.style.touchAction =
      "pan-x pan-y";


    container.style.overflow =
      "auto";


    container.style.webkitOverflowScrolling =
      "touch";


    container.setAttribute(
      "role",
      "region"
    );


    container.setAttribute(
      "aria-label",
      "Question paper PDF"
    );

  }


  bindPdfControls();


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

        goToPdfPage(
          currentPdfPage - 1
        );

      }
    );


  $("pdfNextBtn")
    ?.addEventListener(
      "click",
      () => {

        goToPdfPage(
          currentPdfPage + 1
        );

      }
    );


  $("pdfZoomOutBtn")
    ?.addEventListener(
      "click",
      () => {

        setPdfZoom(
          currentPdfScale -
            0.1
        );

      }
    );


  $("pdfZoomInBtn")
    ?.addEventListener(
      "click",
      () => {

        setPdfZoom(
          currentPdfScale +
            0.1
        );

      }
    );

}


/* =========================================================
   PDF PAGE NAVIGATION
   ========================================================= */

function goToPdfPage(
  pageNumber
) {

  if (
    !currentPdfDocument
  ) {
    return;
  }


  const total =
    currentPdfDocument.numPages;


  const target =
    Math.max(
      1,
      Math.min(
        total,
        Number(
          pageNumber
        )
      )
    );


  if (
    target ===
    currentPdfPage
  ) {

    return;

  }


  currentPdfPage =
    target;


  renderPdfPage(
    false
  );

}


/* =========================================================
   PDF ZOOM
   ========================================================= */

function setPdfZoom(
  scale
) {

  currentPdfScale =
    Math.max(
      0.5,
      Math.min(
        3,
        Math.round(
          scale * 100
        ) / 100
      )
    );


  updatePdfZoom();


  renderPdfPage(
    true
  );

}


/* =========================================================
   PDF ZOOM LABEL
   ========================================================= */

function updatePdfZoom() {

  const value =
    $("pdfZoomValue");


  if (
    value
  ) {

    value.textContent =
      `${Math.round(
        currentPdfScale *
          100
      )}%`;

  }

}


/* =========================================================
   PDF BUTTON STATE
   ========================================================= */

function updatePdfButtons() {

  const previous =
    $("pdfPrevBtn");


  const next =
    $("pdfNextBtn");


  if (
    previous
  ) {

    previous.disabled =
      !currentPdfDocument ||
      currentPdfPage <= 1;

  }


  if (
    next
  ) {

    next.disabled =
      !currentPdfDocument ||
      currentPdfPage >=
        currentPdfDocument.numPages;

  }

}


/* =========================================================
   PDF PAGE INFO
   ========================================================= */

function updatePdfPageInfo() {

  const info =
    $("pdfPageInfo");


  if (
    !info
  ) {
    return;
  }


  if (
    !currentPdfDocument
  ) {

    info.textContent =
      "0 / 0";

    return;

  }


  info.textContent =
    `${currentPdfPage} / ${currentPdfDocument.numPages}`;

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


  const availableWidth =
    Math.max(
      280,
      container.clientWidth -
        32
    );


  const fitted =
    availableWidth /
    viewport.width;


  /*
     Keep the initial page readable.

     Manual zoom can then go up to 300%.
  */

  return Math.max(
    0.5,
    Math.min(
      1.5,
      fitted
    )
  );

}


/* =========================================================
   PDF RENDER
   ========================================================= */

async function renderPdfPage(
  preservePosition = false
) {

  if (
    !currentPdfDocument
  ) {

    return;

  }


  if (
    pdfRendering
  ) {

    pdfRenderQueued =
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


  pdfRenderQueued =
    false;


  const token =
    pdfRenderToken;


  const oldScrollLeft =
    container.scrollLeft;


  const oldScrollTop =
    container.scrollTop;


  try {

    const page =
      await currentPdfDocument.getPage(
        currentPdfPage
      );


    if (
      token !==
      pdfRenderToken
    ) {

      return;

    }


    const viewport =
      page.getViewport({
        scale:
          currentPdfScale
      });


    /*
       Retina / high-DPI rendering.

       Maximum 2x to keep Android memory usage
       under control.
    */

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


    /*
       IMPORTANT:

       CSS width is the REAL PDF width.

       We do NOT use width: 100%.

       Therefore zoom actually makes the page
       larger and Android can scroll horizontally.
    */

    canvas.style.width =
      `${viewport.width}px`;


    canvas.style.height =
      `${viewport.height}px`;


    canvas.style.display =
      "block";


    const context =
      canvas.getContext(
        "2d",
        {
          alpha:
            false
        }
      );


    if (
      !context
    ) {

      throw new Error(
        "Could not create PDF canvas."
      );

    }


    context.setTransform(
      ratio,
      0,
      0,
      ratio,
      0,
      0
    );


    await page
      .render({
        canvasContext:
          context,

        viewport
      })
      .promise;


    if (
      token !==
      pdfRenderToken
    ) {

      return;

    }


    hide(
      $("pdfLoading")
    );


    updatePdfPageInfo();

    updatePdfButtons();

    updatePdfZoom();


    /*
       Restore position after zoom.

       This keeps Android users near the same
       location after pressing + or −.
    */

    if (
      preservePosition
    ) {

      container.scrollLeft =
        oldScrollLeft;

      container.scrollTop =
        oldScrollTop;

    } else {

      /*
         New page starts from top-left.
      */

      container.scrollLeft =
        0;

      container.scrollTop =
        0;

    }

  } catch (
    error
  ) {

    console.error(
      "PDF render error:",
      error
    );


    const loading =
      $("pdfLoading");


    if (
      loading
    ) {

      loading.innerHTML = `

        <strong>
          Could not display this page.
        </strong>

        <span>
          Please try again.
        </span>

        <button
          type="button"
          id="pdfRetryBtn"
          class="secondary-btn small-btn"
        >
          Retry
        </button>

      `;


      show(
        loading
      );


      $("pdfRetryBtn")
        ?.addEventListener(
          "click",
          () => {

            loading.innerHTML = `
              <strong>
                Loading page...
              </strong>

              <span>
                Please wait
              </span>
            `;

            renderPdfPage(
              false
            );

          },
          {
            once:
              true
          }
        );

    }

  } finally {

    pdfRendering =
      false;


    if (
      pdfRenderQueued
    ) {

      pdfRenderQueued =
        false;


      requestAnimationFrame(
        () => {

          renderPdfPage(
            true
          );

        }
      );

    }

  }

}


/* =========================================================
   PDF INITIALIZATION
   ========================================================= */

async function initializePdfViewer(
  url
) {

  if (!url) {

    throw new Error(
      "Question paper URL is missing."
    );

  }


  /*
     Cancel/invalidate every previous render.
  */

  pdfRenderToken++;


  const token =
    pdfRenderToken;


  /*
     Destroy only the browser's previous PDF.js
     document.

     NOTHING is deleted from Supabase.
  */

  if (
    currentPdfDocument
  ) {

    try {

      await currentPdfDocument.destroy();

    } catch (
      destroyError
    ) {

      console.warn(
        "Previous PDF cleanup:",
        destroyError
      );

    }

  }


  currentPdfDocument =
    null;


  currentPdfLoadingTask =
    null;


  currentPdfPage =
    1;


  currentPdfScale =
    1;


  currentPdfUrl =
    url;


  /*
     Create exactly ONE viewer.
  */

  createPdfViewer();


  const loading =
    $("pdfLoading");


  if (
    loading
  ) {

    loading.innerHTML = `

      <strong>
        Loading question paper...
      </strong>

      <span>
        Downloading PDF
      </span>

    `;


    show(
      loading
    );

  }


  updatePdfPageInfo();

  updatePdfButtons();


  try {

    /*
       Load PDF.js.
    */

    const pdfjsLib =
      await loadPdfJs();


    if (
      token !==
      pdfRenderToken
    ) {

      return;

    }


    /*
       -----------------------------------------------------
       CRITICAL FIX
       -----------------------------------------------------

       Download the actual PDF first.

       PDF.js receives binary data instead of the URL.

       This is the main change from the previous version.
       -----------------------------------------------------
    */

    const pdfData =
      await fetchPdfData(
        url
      );


    if (
      token !==
      pdfRenderToken
    ) {

      return;

    }


    /*
       Load the PDF from binary data.
    */

    const loadingTask =
      pdfjsLib.getDocument({

        data:
          pdfData,

        disableAutoFetch:
          false,

        disableStream:
          false,

        isEvalSupported:
          true

      });


    currentPdfLoadingTask =
      loadingTask;


    const document =
      await loadingTask.promise;


    if (
      token !==
      pdfRenderToken
    ) {

      try {

        await document.destroy();

      } catch {}

      return;

    }


    currentPdfDocument =
      document;


    updatePdfPageInfo();

    updatePdfButtons();


    /*
       Wait until the viewer has its actual width.
    */

    await new Promise(
      (
        resolve
      ) => {

        requestAnimationFrame(
          () => {

            resolve();

          }
        );

      }
    );


    currentPdfScale =
      await getInitialPdfScale();


    updatePdfZoom();


    await renderPdfPage(
      false
    );

  } catch (
    error
  ) {

    console.error(
      "PDF loading error:",
      error
    );


    const loading =
      $("pdfLoading");


    if (
      loading
    ) {

      loading.innerHTML = `

        <strong>
          Unable to load the question paper.
        </strong>

        <span>
          ${escapeHtml(
            error.message ||
              "PDF loading failed."
          )}
        </span>

        <button
          type="button"
          id="pdfReloadBtn"
          class="secondary-btn small-btn"
        >
          Try Again
        </button>

      `;


      show(
        loading
      );


      $("pdfReloadBtn")
        ?.addEventListener(
          "click",
          () => {

            initializePdfViewer(
              currentPdfUrl
            );

          },
          {
            once:
              true
          }
        );

    }


    /*
       Do NOT break the entire exam if the PDF viewer
       fails.

       The OMR section must remain usable.
    */

    console.error(
      "Question paper viewer failed:",
      error
    );

  }

}


/* =========================================================
   OPEN PDF LINK
   ========================================================= */

function updateExternalPdfLink(
  url
) {

  const link =
    $("pdfExternalLink");


  if (
    !link
  ) {

    return;

  }


  link.href =
    url || "#";


  if (
    !url
  ) {

    link.style.pointerEvents =
      "none";

  } else {

    link.style.pointerEvents =
      "";

  }

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


  hideStatus(
    status
  );


  if (!code) {

    showStatus(
      status,
      "Please enter the test code.",
      "error"
    );

    return;

  }


  if (
    code.length !==
    6
  ) {

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


    if (
      $("examName")
    ) {

      $("examName")
        .textContent =
        test.name;

    }


    if (
      $("examInfo")
    ) {

      $("examInfo")
        .textContent =
        `${currentQuestionCount} Questions • Code: ${test.code}`;

    }


    /*
       External fallback link.
    */

    updateExternalPdfLink(
      currentPdfUrl
    );


    /*
       IMPORTANT:

       Show exam BEFORE initializing PDF.

       The viewer needs its actual width.
    */

    showScreen(
      "examScreen"
    );


    const nameInput =
      $("candidateName");


    if (
      nameInput
    ) {

      nameInput.value =
        "";

    }


    renderExam();


    /*
       Give Android one or two frames to finish
       calculating the visible layout.
    */

    await new Promise(
      (
        resolve
      ) => {

        requestAnimationFrame(
          () => {

            requestAnimationFrame(
              resolve
            );

          }
        );

      }
    );


    /*
       Now load the PDF.
    */

    await initializePdfViewer(
      currentPdfUrl
    );

  } catch (
    error
  ) {

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
   RESET EXAM
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
          (
            input
          ) => {

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
   CALCULATE RESULT
   ========================================================= */

function calculateResult() {

  const answerKey =
    Array.isArray(
      currentTest?.answer_key
    )
      ? currentTest.answer_key
      : [];


  const correctMark =
    Number(
      currentTest?.correct_mark
    ) || 0;


  const wrongMark =
    Number(
      currentTest?.wrong_mark
    ) || 0;


  let correct =
    0;


  let wrong =
    0;


  let unanswered =
    0;


  for (
    let i = 0;
    i <
    currentQuestionCount;
    i++
  ) {

    const selected =
      selectedAnswers[i];


    if (
      !selected
    ) {

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


  /*
     Negative marking.

     wrongMark may already be negative, therefore
     Math.abs() is used here.
  */

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
        ) *
        100
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


/* =========================================================
   SAVE EXAM RESULT
   ========================================================= */

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


  if (
    error
  ) {

    throw error;

  }

}


/* =========================================================
   FORMAT NUMBER
   ========================================================= */

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


/* =========================================================
   RESULT UI
   ========================================================= */

function renderResult(
  result
) {

  const box =
    $("resultBox");


  if (
    !box
  ) {

    return;

  }


  const percentage =
    Number(
      result.percentage
    ) || 0;


  box.innerHTML = `

    <div
      class="result-title"
    >
      Result
    </div>


    <p>
      ${escapeHtml(
        result.candidateName ||
          "Candidate"
      )}
      •
      ${escapeHtml(
        result.testName ||
          ""
      )}
    </p>


    <div
      class="result-stats"
    >

      <div
        class="result-stat"
      >

        <span>
          Correct
        </span>

        <strong>
          ${result.correct}
        </strong>

      </div>


      <div
        class="result-stat"
      >

        <span>
          Wrong
        </span>

        <strong>
          ${result.wrong}
        </strong>

      </div>


      <div
        class="result-stat"
      >

        <span>
          Unanswered
        </span>

        <strong>
          ${result.unanswered}
        </strong>

      </div>


      <div
        class="result-stat"
      >

        <span>
          Percentage
        </span>

        <strong>
          ${percentage.toFixed(
            2
          )}%
        </strong>

      </div>

    </div>


    <div
      class="score-display"
    >

      <span>
        Score
      </span>

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


  show(
    box
  );


  box.scrollIntoView({
    behavior:
      "smooth",

    block:
      "nearest"
  });

}


/* =========================================================
   SUBMIT EXAM
   ========================================================= */

$("submitExamBtn")
  ?.addEventListener(
    "click",
    async () => {

      if (
        !currentTest
      ) {

        return;

      }


      const input =
        $("candidateName");


      candidateName =
        input?.value
          ?.trim() ||
        "";


      if (
        !candidateName
      ) {

        alert(
          "Please enter your name before submitting the exam."
        );


        input?.focus();


        return;

      }


      const unanswered =
        selectedAnswers.filter(
          (
            answer
          ) =>
            !answer
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

        /*
           Calculate locally first.

           Therefore the result can still be shown
           even if Supabase temporarily fails.
        */

        const result =
          calculateResult();


        /*
           Try to save the result.

           A database failure should NOT erase the
           candidate's result from the screen.
        */

        try {

          await saveExamResult(
            result
          );

        } catch (
          saveError
        ) {

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
   CHECK SINGLE RESULT
   ========================================================= */

async function checkSingleResult() {

  const code =
    $("resultCode")
      ?.value
      ?.trim()
      .toUpperCase();


  const status =
    $("resultStatus");


  const box =
    $("singleResultBox");


  hideStatus(
    status
  );


  hide(
    box
  );


  if (
    !code
  ) {

    showStatus(
      status,
      "Please enter the test code.",
      "error"
    );

    return;

  }


  setLoading(
    true,
    "Loading result..."
  );


  try {

    const {
      data,
      error
    } =
      await supabaseClient
        .from(
          "exam_results"
        )
        .select("*")
        .eq(
          "test_code",
          code
        )
        .order(
          "created_at",
          {
            ascending:
              false
          }
        )
        .limit(1);


    if (
      error
    ) {

      throw error;

    }


    if (
      !data ||
      data.length === 0
    ) {

      throw new Error(
        "No result found for this test code."
      );

    }


    const result =
      data[0];


    const percentage =
      Number(
        result.percentage
      ) || 0;


    box.innerHTML = `

      <div
        class="result-title"
      >
        Result
      </div>


      <p>
        ${escapeHtml(
          result.candidate_name ||
            "Candidate"
        )}
      </p>


      <div
        class="result-stats"
      >

        <div
          class="result-stat"
        >

          <span>
            Correct
          </span>

          <strong>
            ${result.correct ?? 0}
          </strong>

        </div>


        <div
          class="result-stat"
        >

          <span>
            Wrong
          </span>

          <strong>
            ${result.wrong ?? 0}
          </strong>

        </div>


        <div
          class="result-stat"
        >

          <span>
            Unanswered
          </span>

          <strong>
            ${result.unanswered ?? 0}
          </strong>

        </div>


        <div
          class="result-stat"
        >

          <span>
            Percentage
          </span>

          <strong>
            ${percentage.toFixed(
              2
            )}%
          </strong>

        </div>

      </div>


      <div
        class="score-display"
      >

        <span>
          Score
        </span>

        <strong>
          ${formatNumber(
            result.score ||
              0
          )}
          /
          ${formatNumber(
            result.total_marks ||
              0
          )}
        </strong>

      </div>

    `;


    show(
      box
    );

  } catch (
    error
  ) {

    console.error(
      "Single result error:",
      error
    );


    showStatus(
      status,
      error.message ||
        "Could not load result.",
      "error"
    );

  } finally {

    setLoading(
      false
    );

  }

}


/* =========================================================
   CHECK ALL RESULTS
   ========================================================= */

async function checkAllResults() {

  const code =
    $("resultsCode")
      ?.value
      ?.trim()
      .toUpperCase();


  const status =
    $("resultsStatus");


  const summary =
    $("resultsSummary");


  const table =
    $("resultsTableContainer");


  hideStatus(
    status
  );


  hide(
    summary
  );


  hide(
    table
  );


  if (
    !code
  ) {

    showStatus(
      status,
      "Please enter the test code.",
      "error"
    );

    return;

  }


  setLoading(
    true,
    "Loading all results..."
  );


  try {

    /*
       First get test information.
    */

    const {
      data:
        testData,
      error:
        testError
    } =
      await supabaseClient
        .from(
          "tests"
        )
        .select(
          "name,question_count,correct_mark"
        )
        .eq(
          "code",
          code
        )
        .limit(1);


    if (
      testError
    ) {

      throw testError;

    }


    if (
      !testData ||
      testData.length === 0
    ) {

      throw new Error(
        "Test not found."
      );

    }


    /*
       Get every submitted result.
    */

    const {
      data,
      error
    } =
      await supabaseClient
        .from(
          "exam_results"
        )
        .select("*")
        .eq(
          "test_code",
          code
        )
        .order(
          "score",
          {
            ascending:
              false
          }
        );


    if (
      error
    ) {

      throw error;

    }


    if (
      !data ||
      data.length === 0
    ) {

      throw new Error(
        "No results found for this test yet."
      );

    }


    const test =
      testData[0];


    const scores =
      data.map(
        (
          item
        ) =>
          Number(
            item.score
          ) || 0
      );


    const highest =
      Math.max(
        ...scores
      );


    const average =
      scores.reduce(
        (
          total,
          value
        ) =>
          total +
          value,
        0
      ) /
      scores.length;


    /*
       SUMMARY
    */

    if (
      summary
    ) {

      summary.innerHTML = `

        <div
          class="result-stat"
        >

          <span>
            Test
          </span>

          <strong>
            ${escapeHtml(
              test.name ||
                code
            )}
          </strong>

        </div>


        <div
          class="result-stat"
        >

          <span>
            Candidates
          </span>

          <strong>
            ${data.length}
          </strong>

        </div>


        <div
          class="result-stat"
        >

          <span>
            Highest
          </span>

          <strong>
            ${formatNumber(
              highest
            )}
          </strong>

        </div>


        <div
          class="result-stat"
        >

          <span>
            Average
          </span>

          <strong>
            ${formatNumber(
              average
            )}
          </strong>

        </div>

      `;


      show(
        summary
      );

    }


    /*
       RESULTS TABLE
    */

    if (
      table
    ) {

      let rows =
        "";


      data.forEach(
        (
          item,
          index
        ) => {

          rows += `

            <tr>

              <td>
                ${index + 1}
              </td>

              <td>
                ${escapeHtml(
                  item.candidate_name ||
                    "Candidate"
                )}
              </td>

              <td>
                ${item.correct ?? 0}
              </td>

              <td>
                ${item.wrong ?? 0}
              </td>

              <td>
                ${item.unanswered ?? 0}
              </td>

              <td>
                ${formatNumber(
                  item.score ||
                    0
                )}
              </td>

              <td>
                ${Number(
                  item.percentage ||
                    0
                ).toFixed(
                  2
                )}%
              </td>

            </tr>

          `;

        }
      );


      table.innerHTML = `

        <div
          class="results-table-wrapper"
        >

          <table
            class="results-table"
          >

            <thead>

              <tr>

                <th>
                  #
                </th>

                <th>
                  Candidate
                </th>

                <th>
                  Correct
                </th>

                <th>
                  Wrong
                </th>

                <th>
                  Unanswered
                </th>

                <th>
                  Score
                </th>

                <th>
                  Percentage
                </th>

              </tr>

            </thead>


            <tbody>

              ${rows}

            </tbody>

          </table>

        </div>

      `;


      show(
        table
      );

    }

  } catch (
    error
  ) {

    console.error(
      "All results error:",
      error
    );


    showStatus(
      status,
      error.message ||
        "Could not load results.",
      "error"
    );

  } finally {

    setLoading(
      false
    );

  }

}


/* =========================================================
   RESULT BUTTON EVENTS
   ========================================================= */

$("checkResultBtn")
  ?.addEventListener(
    "click",
    checkSingleResult
  );


$("checkAllResultsBtn")
  ?.addEventListener(
    "click",
    checkAllResults
  );


/* =========================================================
   ENTER KEY SUPPORT
   ========================================================= */

$("resultCode")
  ?.addEventListener(
    "keydown",
    (
      event
    ) => {

      if (
        event.key ===
        "Enter"
      ) {

        event.preventDefault();

        checkSingleResult();

      }

    }
  );


$("resultsCode")
  ?.addEventListener(
    "keydown",
    (
      event
    ) => {

      if (
        event.key ===
        "Enter"
      ) {

        event.preventDefault();

        checkAllResults();

      }

    }
  );


/* =========================================================
   BACK TO JOIN SCREEN
   ========================================================= */

$("backToJoinBtn")
  ?.addEventListener(
    "click",
    async () => {

      /*
         Stop current PDF rendering.
      */

      pdfRenderToken++;


      if (
        currentPdfLoadingTask
      ) {

        try {

          await currentPdfLoadingTask.destroy();

        } catch {}

      }


      if (
        currentPdfDocument
      ) {

        try {

          await currentPdfDocument.destroy();

        } catch {}

      }


      currentPdfLoadingTask =
        null;


      currentPdfDocument =
        null;


      currentPdfUrl =
        "";


      currentPdfPage =
        1;


      currentPdfScale =
        1;


      currentTest =
        null;


      selectedAnswers =
        [];


      candidateName =
        "";


      /*
         Remove runtime PDF viewer.

         Again: this does NOT delete the PDF
         from Supabase storage.
      */

      document
        .querySelectorAll(
          ".pdf-viewer"
        )
        .forEach(
          (
            viewer
          ) => {

            viewer.remove();

          }
        );


      showScreen(
        "joinScreen"
      );


      hide(
        $("resultBox")
      );

    }
  );


/* =========================================================
   WINDOW RESIZE
   ========================================================= */

/*
   Android orientation changes and desktop resizing
   can change the available PDF width.

   We don't automatically reset manual zoom.

   We only re-render when the viewer is active.
*/

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
            currentPdfDocument &&
            !pdfRendering
          ) {

            renderPdfPage(
              true
            );

          }

        },
        180
      );

  }
);


/* =========================================================
   VISIBILITY RECOVERY
   ========================================================= */

/*
   Some Android browsers pause canvas rendering when
   the tab/app goes into the background.

   When the page becomes visible again, redraw the
   current PDF page.
*/

document.addEventListener(
  "visibilitychange",
  () => {

    if (
      document.visibilityState ===
      "visible"
    ) {

      if (
        currentPdfDocument &&
        !pdfRendering
      ) {

        setTimeout(
          () => {

            renderPdfPage(
              true
            );

          },
          120
        );

      }

    }

  }
);


/* =========================================================
   FINAL STARTUP
   ========================================================= */

updatePdfPageInfo();

updatePdfButtons();

updatePdfZoom();

updateProgress();
/* =========================================================
   HOME NAVIGATION
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

      const input =
        $("joinCode");

      if (input) {
        input.value = "";
        input.focus();
      }

    }
  );


$("showResultBtn")
  ?.addEventListener(
    "click",
    () => {

      showScreen(
        "resultScreen"
      );

      const input =
        $("resultCode");

      if (input) {
        input.value = "";
        input.focus();
      }

    }
  );


$("showResultsBtn")
  ?.addEventListener(
    "click",
    () => {

      showScreen(
        "resultsScreen"
      );

      const input =
        $("resultsCode");

      if (input) {
        input.value = "";
        input.focus();
      }

    }
  );


/* =========================================================
   CREATE SCREEN
   ========================================================= */

$("questionCount")
  ?.addEventListener(
    "input",
    () => {

      const value =
        Number(
          $("questionCount")
            ?.value
        ) || 40;

      currentQuestionCount =
        Math.max(
          1,
          Math.min(
            300,
            value
          )
        );

      renderOptionSettings();

    }
  );


$("defaultOptions")
  ?.addEventListener(
    "change",
    () => {

      renderOptionSettings();

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


$("clearCreateBtn")
  ?.addEventListener(
    "click",
    () => {

      if (
        !confirm(
          "Clear all test creation fields?"
        )
      ) {
        return;
      }


      if (
        $("testName")
      ) {
        $("testName")
          .value = "";
      }


      if (
        $("pdfFile")
      ) {
        $("pdfFile")
          .value = "";
      }


      if (
        $("questionCount")
      ) {
        $("questionCount")
          .value = "40";
      }


      if (
        $("defaultOptions")
      ) {
        $("defaultOptions")
          .value = "4";
      }


      if (
        $("pdfStatus")
      ) {
        $("pdfStatus")
          .textContent = "";
      }


      if (
        $("pdfPreview")
      ) {
        $("pdfPreview")
          .src = "";
      }


      hide(
        $("pdfPreviewBox")
      );


      renderOptionSettings();

    }
  );


/* =========================================================
   ANSWER KEY SCREEN
   ========================================================= */

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
   COPY TEST CODE
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

          const oldText =
            button.textContent;


          button.textContent =
            "Copied ✓";


          setTimeout(
            () => {

              button.textContent =
                oldText;

            },
            1400
          );

        }

      } catch (
        error
      ) {

        /*
           Clipboard API may be blocked on some
           Android browsers.

           Fallback:
        */

        try {

          const textarea =
            document.createElement(
              "textarea"
            );

          textarea.value =
            code;

          textarea.style.position =
            "fixed";

          textarea.style.opacity =
            "0";

          document.body.appendChild(
            textarea
          );

          textarea.focus();

          textarea.select();

          document.execCommand(
            "copy"
          );

          textarea.remove();

          alert(
            "Test code copied."
          );

        } catch (
          fallbackError
        ) {

          alert(
            `Test Code: ${code}`
          );

        }

      }

    }
  );


/* =========================================================
   AFTER TEST CREATION
   ========================================================= */

$("goHomeAfterCreate")
  ?.addEventListener(
    "click",
    () => {

      /*
         Clear only browser-side state.

         Existing test remains safely stored in
         Supabase.
      */

      currentTest =
        null;

      currentPdfUrl =
        "";

      currentAnswerKey =
        [];

      currentOptions =
        [];

      selectedAnswers =
        [];


      showScreen(
        "homeScreen"
      );

    }
  );


/* =========================================================
   JOIN BUTTON
   ========================================================= */

$("joinBtn")
  ?.addEventListener(
    "click",
    joinTest
  );


$("joinCode")
  ?.addEventListener(
    "input",
    (
      event
    ) => {

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
    (
      event
    ) => {

      if (
        event.key ===
        "Enter"
      ) {

        event.preventDefault();

        joinTest();

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

      if (
        !confirm(
          "Exit this test?\n\nYour current answers will not be submitted."
        )
      ) {

        return;

      }


      /*
         Stop all current PDF operations.
      */

      pdfRenderToken++;


      if (
        currentPdfLoadingTask
      ) {

        try {

          await currentPdfLoadingTask.destroy();

        } catch {}

      }


      if (
        currentPdfDocument
      ) {

        try {

          await currentPdfDocument.destroy();

        } catch {}

      }


      currentPdfLoadingTask =
        null;


      currentPdfDocument =
        null;


      currentPdfUrl =
        "";


      currentPdfPage =
        1;


      currentPdfScale =
        1;


      currentTest =
        null;


      selectedAnswers =
        [];


      candidateName =
        "";


      /*
         Remove ONLY the browser viewer.

         No Supabase test or PDF is deleted.
      */

      document
        .querySelectorAll(
          ".pdf-viewer"
        )
        .forEach(
          (
            viewer
          ) => {

            viewer.remove();

          }
        );


      showScreen(
        "homeScreen"
      );

    }
  );


/* =========================================================
   RESULT SCREEN NAVIGATION
   ========================================================= */

$("backHomeFromJoin")
  ?.addEventListener(
    "click",
    () => {

      showScreen(
        "homeScreen"
      );

    }
  );


$("backHomeFromResult")
  ?.addEventListener(
    "click",
    () => {

      hide(
        $("singleResultBox")
      );

      hideStatus(
        $("resultStatus")
      );

      showScreen(
        "homeScreen"
      );

    }
  );


$("backHomeFromResults")
  ?.addEventListener(
    "click",
    () => {

      hide(
        $("resultsSummary")
      );

      hide(
        $("resultsTableContainer")
      );

      hideStatus(
        $("resultsStatus")
      );

      showScreen(
        "homeScreen"
      );

    }
  );


/* =========================================================
   CREATED SCREEN -> HOME
   ========================================================= */

$("createdCode")
  ?.addEventListener(
    "click",
    async () => {

      const code =
        $("createdCode")
          ?.textContent
          ?.trim();


      if (
        !code
      ) {
        return;
      }


      try {

        await navigator
          .clipboard
          .writeText(
            code
          );

      } catch {}

    }
  );


/* =========================================================
   RESULT CODE INPUT NORMALIZATION
   ========================================================= */

$("resultCode")
  ?.addEventListener(
    "input",
    (
      event
    ) => {

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


$("resultsCode")
  ?.addEventListener(
    "input",
    (
      event
    ) => {

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


/* =========================================================
   CANDIDATE NAME
   ========================================================= */

$("candidateName")
  ?.addEventListener(
    "input",
    (
      event
    ) => {

      candidateName =
        event.target.value
          .trim();

    }
  );


/* =========================================================
   PREVENT ACCIDENTAL FORM SUBMISSION
   ========================================================= */

document
  .addEventListener(
    "keydown",
    (
      event
    ) => {

      if (
        event.key !==
        "Enter"
      ) {

        return;

      }


      const target =
        event.target;


      /*
         Don't interfere with text inputs where Enter
         may have a normal meaning.

         Specific Enter handlers above handle:
         - join code
         - result code
         - all-results code
      */

      if (
        target instanceof
          HTMLTextAreaElement
      ) {

        return;

      }

    }
  );


/* =========================================================
   PDF TOUCH SWIPE
   ========================================================= */

/*
   Android users can also swipe horizontally on the
   PDF area to move between pages.

   IMPORTANT:

   This does NOT replace normal PDF scrolling.

   A swipe is only interpreted as page navigation when
   the horizontal movement is clearly larger than the
   vertical movement.
*/

const pdfTouchContainer =
  document.getElementById(
    "pdfViewerMount"
  );


function attachPdfTouchNavigation() {

  const container =
    document.querySelector(
      "#pdfCanvasContainer"
    );


  if (
    !container ||
    container.dataset.touchBound ===
      "true"
  ) {

    return;

  }


  container.dataset.touchBound =
    "true";


  container.addEventListener(
    "touchstart",
    (
      event
    ) => {

      if (
        event.touches.length !==
        1
      ) {

        return;

      }


      const touch =
        event.touches[0];


      pdfTouchStartX =
        touch.clientX;


      pdfTouchStartY =
        touch.clientY;

    },
    {
      passive:
        true
    }
  );


  container.addEventListener(
    "touchend",
    (
      event
    ) => {

      if (
        event.changedTouches.length !==
        1
      ) {

        return;

      }


      const touch =
        event.changedTouches[0];


      const dx =
        touch.clientX -
        pdfTouchStartX;


      const dy =
        touch.clientY -
        pdfTouchStartY;


      /*
         Only a strong horizontal swipe becomes
         page navigation.
      */

      if (
        Math.abs(dx) <
        80
      ) {

        return;

      }


      if (
        Math.abs(dx) <=
        Math.abs(dy) *
          1.25
      ) {

        return;

      }


      if (
        dx < 0
      ) {

        goToPdfPage(
          currentPdfPage + 1
        );

      } else {

        goToPdfPage(
          currentPdfPage - 1
        );

      }

    },
    {
      passive:
        true
    }
  );

}


/* =========================================================
   PDF VIEWER MOUNT OBSERVER
   ========================================================= */

/*
   The PDF viewer is dynamically created after the
   exam screen opens.

   MutationObserver attaches Android touch navigation
   once the canvas container exists.
*/

const pdfMount =
  document.getElementById(
    "pdfViewerMount"
  );


if (
  pdfMount
) {

  const observer =
    new MutationObserver(
      () => {

        attachPdfTouchNavigation();

      }
    );


  observer.observe(
    pdfMount,
    {
      childList:
        true,

      subtree:
        true
    }
  );

}


/* =========================================================
   INITIAL SCREEN
   ========================================================= */

document
  .querySelectorAll(
    ".screen"
  )
  .forEach(
    (
      screen
    ) => {

      hide(
        screen
      );

    }
  );


showScreen(
  "homeScreen"
);


/* =========================================================
   INITIAL FORM STATE
   ========================================================= */

if (
  $("questionCount")
) {

  $("questionCount")
    .value =
    "40";

}


if (
  $("defaultOptions")
) {

  $("defaultOptions")
    .value =
    "4";

}


renderOptionSettings();


/* =========================================================
   INITIAL PDF STATE
   ========================================================= */

currentPdfDocument =
  null;

currentPdfLoadingTask =
  null;

currentPdfPage =
  1;

currentPdfScale =
  1;

pdfRendering =
  false;

pdfRenderQueued =
  false;


/* =========================================================
   FINAL READY MESSAGE
   ========================================================= */

console.log(
  "Exam OMR initialized successfully."
);

console.log(
  "PDF viewer mode: binary fetch + PDF.js canvas"
);

console.log(
  "Android touch support: enabled"
);