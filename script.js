/* =========================================================
   EXAM OMR — COMPLETE SCRIPT
   Matches the current index.html
   ========================================================= */

const SUPABASE_URL =
  "https://veanswqdgwffiespeokc.supabase.co";

const SUPABASE_KEY =
  "sb_publishable_IuXKh35oKJiu3_a3HKurkw_YSURgtdT";

const supabaseClient =
  window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
  );


/* =========================================================
   CONFIG
   ========================================================= */

const STORAGE_BUCKET =
  "question-papers";

const PDFJS_VERSION =
  "4.10.38";

const PDFJS_URL =
  `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.min.mjs`;

const PDFJS_WORKER =
  `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.mjs`;

const OPTION_LABELS =
  ["A", "B", "C", "D"];


/* =========================================================
   PDF.JS LOADER
   ========================================================= */

async function loadPdfJs() {

  if (pdfModule) {
    return pdfModule;
  }

  pdfModule =
    await import(
      PDFJS_URL
    );

  if (
    pdfModule &&
    pdfModule.GlobalWorkerOptions
  ) {

    pdfModule
      .GlobalWorkerOptions
      .workerSrc =
      PDFJS_WORKER;
  }

  return pdfModule;
}


/* =========================================================
   STATE
   ========================================================= */

let currentTest = null;

let currentQuestionCount = 40;

let currentOptions = [];

let currentAnswerKey = [];

let selectedAnswers = [];

let currentPdfUrl = "";

let currentPdfDocument = null;

let currentPdfPage = 1;

let currentPdfScale = 1;
let currentExamPage = 0;
const QUESTIONS_PER_PAGE = 10;
let pdfPageCanvases = [];

let pdfModule = null;

let timerInterval = null;

let remainingSeconds = 0;

let examSubmitted = false;


/*
 * Typed question state
 */

let currentTypedQuestions = [];


/* =========================================================
   SHORT DOM HELPER
   ========================================================= */

function $(id) {
  return document.getElementById(id);
}


/* =========================================================
   BASIC UI
   ========================================================= */

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


function showScreen(id) {

  document
    .querySelectorAll(".screen")
    .forEach(
      screen => {

        screen.classList.add(
          "hidden"
        );

      }
    );

  const screen =
    $(id);

  if (screen) {

    screen.classList.remove(
      "hidden"
    );

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


function setLoading(
  active,
  text = "Please wait..."
) {

  const overlay =
    $("loadingOverlay");

  const loadingText =
    $("loadingText");

  if (loadingText) {

    loadingText.textContent =
      text;

  }

  if (active) {

    show(
      overlay
    );

  } else {

    hide(
      overlay
    );

  }

}


function statusBox(
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

  show(
    element
  );

}


function clearStatus(
  element
) {

  if (!element) {
    return;
  }

  element.textContent =
    "";

  hide(
    element
  );

}


/* =========================================================
   OPTION HELPERS
   ========================================================= */

function getOptionLabels(
  count
) {

  return OPTION_LABELS.slice(
    0,
    Number(count) === 2
      ? 2
      : 4
  );

}


/* =========================================================
   TEST CODE
   ========================================================= */

function randomCode() {

  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  let code = "";

  for (
    let i = 0;
    i < 6;
    i++
  ) {

    code +=
      chars[
        Math.floor(
          Math.random() *
          chars.length
        )
      ];

  }

  return code;
}


async function uniqueCode() {

  for (
    let attempt = 0;
    attempt < 10;
    attempt++
  ) {

    const code =
      randomCode();

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
   CREATE TEST — OPTION SETTINGS
   ========================================================= */

function renderOptionSettings() {

  const box =
    $("optionSettings");

  if (!box) {
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

  const defaultOptions =
    Number(
      $("defaultOptions")
        ?.value
    ) === 2
      ? 2
      : 4;

  currentQuestionCount =
    count;

  box.innerHTML =
    "";

  for (
    let i = 0;
    i < count;
    i++
  ) {

    box.insertAdjacentHTML(
      "beforeend",
      `
        <div class="option-setting">

          <div class="option-setting-number">
            ${i + 1}
          </div>

          <select
            class="question-option-count"
            data-question="${i}"
          >

            <option
              value="4"
              ${defaultOptions === 4
                ? "selected"
                : ""}
            >
              4 Options
            </option>

            <option
              value="2"
              ${defaultOptions === 2
                ? "selected"
                : ""}
            >
              2 Options
            </option>

          </select>

        </div>
      `
    );

  }

}


function getQuestionOptions() {

  return [
    ...document.querySelectorAll(
      ".question-option-count"
    )
  ].map(
    select =>
      Number(
        select.value
      ) === 2
        ? 2
        : 4
  );

}


/* =========================================================
   PDF FILE SELECTION
   ========================================================= */

$("pdfFile")
  ?.addEventListener(
    "change",
    event => {

      const file =
        event.target
          ?.files?.[0];

      const status =
        $("pdfStatus");

      const previewBox =
        $("pdfPreviewBox");

      const preview =
        $("pdfPreview");

      hide(
        previewBox
      );

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

          status.style.color =
            "#dc2626";

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

async function uploadPdf(
  file,
  code
) {

  if (!file) {

    throw new Error(
      "Please select a question paper PDF."
    );

  }

  const name =
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
        name,
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
        name
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

  const box =
    $("answerKeyGrid");

  if (!box) {
    return;
  }

  box.innerHTML =
    "";

  for (
    let i = 0;
    i < currentQuestionCount;
    i++
  ) {

    const labels =
      getOptionLabels(
        currentOptions[i] || 4
      );

    box.insertAdjacentHTML(
      "beforeend",
      `
        <div class="answer-key-item">

          <strong>
            Question ${i + 1}
          </strong>

          <select
            class="answer-key-select"
            data-question="${i}"
          >

            <option value="">
              Select
            </option>

            ${labels
              .map(
                label =>
                  `
                    <option value="${label}">
                      ${label}
                    </option>
                  `
              )
              .join("")}

          </select>

        </div>
      `
    );

  }

}


function getAnswerKey() {

  return [
    ...document.querySelectorAll(
      ".answer-key-select"
    )
  ].map(
    select =>
      select.value
  );

}


/* =========================================================
   CREATE PDF TEST
   ========================================================= */

$("generateBtn")
  ?.addEventListener(
    "click",
    async () => {

      const name =
        $("testName")
          ?.value
          ?.trim();

      const file =
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

      if (!file) {

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
        getQuestionOptions();

      setLoading(
        true,
        "Preparing your test..."
      );

      try {

        const code =
          await uniqueCode();

        setLoading(
          true,
          "Uploading question paper..."
        );

        const pdfUrl =
          await uploadPdf(
            file,
            code
          );

        currentTest = {

          name,

          code,

          pdf_url:
            pdfUrl,

          question_count:
            count,

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
        getAnswerKey();

      if (
        answerKey.length !==
          currentQuestionCount ||
        answerKey.some(
          answer =>
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
                currentTest.code,

              duration_minutes:
                Number(
                  $("durationMinutes")
                    ?.value
                ) || 0

            })
            .select()
            .single();

        if (error) {
          throw error;
        }

        currentTest =
          data;

        if ($("createdCode")) {

          $("createdCode")
            .textContent =
            data.code;

        }

        showScreen(
          "createdScreen"
        );

      } catch (error) {

        console.error(
          error
        );

        statusBox(
          $("saveStatus"),
          error.message ||
            "Could not save test.",
          "error"
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
    String(
      code || ""
    )
      .trim()
      .toUpperCase();

  if (!cleanCode) {

    throw new Error(
      "Please enter a test code."
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
   JOIN TEST
   ========================================================= */

$("joinBtn")
  ?.addEventListener(
    "click",
    async () => {

      const code =
        $("joinCode")
          ?.value
          ?.trim()
          .toUpperCase();

      const status =
        $("joinStatus");

      clearStatus(
        status
      );

      if (!code) {

        statusBox(
          status,
          "Please enter the test code.",
          "error"
        );

        return;
      }

      setLoading(
        true,
        "Loading examination..."
      );

      try {

        currentTest =
          await loadTestByCode(
            code
          );

        currentQuestionCount =
          Number(
            currentTest.question_count
          ) || 0;

        currentOptions =
          Array.isArray(
            currentTest.options
          )
            ? currentTest.options
            : new Array(
                currentQuestionCount
              ).fill(4);

        currentAnswerKey =
          Array.isArray(
            currentTest.answer_key
          )
            ? currentTest.answer_key
            : [];

        selectedAnswers =
          new Array(
            currentQuestionCount
          ).fill("");

        examSubmitted =
          false;

        if ($("examName")) {

          $("examName")
            .textContent =
            currentTest.name;

        }

        if ($("examInfo")) {

          $("examInfo")
            .textContent =
            `${currentQuestionCount} Questions • Code: ${currentTest.code}`;

        }

        if ($("candidateName")) {

          $("candidateName")
            .value =
            "";

        }

        showScreen(
          "examScreen"
        );


        /* =================================================
           DETECT TEST TYPE
           ================================================= */

        const isTypedTest =
          currentTest.creation_type ===
            "typed" ||
          Boolean(
            currentTest.question_data
          );


        if (isTypedTest) {

          currentTypedQuestions =
            parseTypedQuestionData(
              currentTest
            );

          currentQuestionCount =
            currentTypedQuestions.length;

          currentOptions =
            currentTypedQuestions.map(
              question =>
                Number(
                  question?.option_count
                ) === 2
                  ? 2
                  : 4
            );

          if (
            Array.isArray(
              currentTest.answer_key
            ) &&
            currentTest.answer_key.length
          ) {

            currentAnswerKey =
              currentTest.answer_key
                .map(
                  answer =>
                    String(
                      answer || ""
                    )
                      .trim()
                      .toUpperCase()
                );

          } else {

            currentAnswerKey =
              currentTypedQuestions.map(
                question =>
                  String(
                    question?.answer ||
                    ""
                  )
                    .trim()
                    .toUpperCase()
              );

          }

          selectedAnswers =
            new Array(
              currentQuestionCount
            ).fill("");

          renderTypedExam();

          setTypedExamPdfVisibility(
            true
          );

        } else {

          currentTypedQuestions =
            [];

          setTypedExamPdfVisibility(
            false
          );

          renderExam();

          await initializePdfViewer(
            currentTest.pdf_url
          );

        }


        startExamTimer(
          Number(
            currentTest.duration_minutes
          ) || 0
        );


      } catch (error) {

        console.error(
          error
        );

        statusBox(
          status,
          error.message ||
            "Could not load test.",
          "error"
        );

      } finally {

        setLoading(
          false
        );

      }

    }
  );


/* =========================================================
   TYPED QUESTION DATA
   ========================================================= */

function parseTypedQuestionData(
  test
) {

  let data =
    test?.question_data;

  if (!data) {

    throw new Error(
      "This typed test does not contain question data."
    );

  }

  if (
    typeof data ===
    "string"
  ) {

    try {

      data =
        JSON.parse(
          data
        );

    } catch {

      throw new Error(
        "The typed question data is invalid."
      );

    }

  }

  const questions =
    Array.isArray(
      data?.questions
    )
      ? data.questions
      : [];

  if (
    !questions.length
  ) {

    throw new Error(
      "No questions were found in this typed test."
    );

  }

  return questions;

}


/* =========================================================
   TYPED/PDF VIEWER VISIBILITY
   ========================================================= */

function setTypedExamPdfVisibility(
  isTyped
) {

  const pdfCard =
    document.querySelector(
      ".pdf-card"
    );

  const workspace =
    document.querySelector(
      ".exam-workspace"
    );

  const navigator =
    $("questionNavigator");

  const pageNavigation =
    $("examPageNavigation");

  if (isTyped) {

    hide(
      pdfCard
    );

    hide(
      navigator
    );

    hide(
      pageNavigation
    );

    workspace
      ?.classList
      .add(
        "typed-exam-mode"
      );

    if (
      currentPdfDocument
    ) {

      try {
        currentPdfDocument.destroy();
      } catch {}

    }

    currentPdfDocument =
      null;

    currentPdfUrl =
      "";

    pdfPageCanvases =
      [];

  } else {

    show(
      pdfCard
    );

    show(
      navigator
    );

    show(
      pageNavigation
    );

    workspace
      ?.classList
      .remove(
        "typed-exam-mode"
      );

  }

}


/* =========================================================
   TYPED EXAM RENDERER
   ========================================================= */

function renderTypedExam() {

  const grid =
    $("examGrid");

  if (!grid) {
    return;
  }

  grid.innerHTML =
    "";

  currentTypedQuestions
    .forEach(
      (
        question,
        index
      ) => {

        const row =
          document.createElement(
            "div"
          );

        row.className =
          "exam-question typed-exam-question";


        const number =
          document.createElement(
            "div"
          );

        number.className =
          "question-number";

        number.textContent =
          String(
            index + 1
          );

        row.appendChild(
          number
        );


        const text =
          document.createElement(
            "div"
          );

        text.className =
          "typed-question-text";

        text.textContent =
          String(
            question?.question ||
            ""
          );

        row.appendChild(
          text
        );


        const options =
          document.createElement(
            "div"
          );

        options.className =
          "typed-exam-options";


        const labels =
          getOptionLabels(
            Number(
              question?.option_count
            ) === 2
              ? 2
              : 4
          );


        labels.forEach(
          option => {

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
              `question-${index}`;

            input.value =
              option;


            const badge =
              document.createElement(
                "span"
              );

            badge.className =
              "typed-option-label";

            badge.textContent =
              option;


            const optionText =
              document.createElement(
                "span"
              );

            optionText.className =
              "typed-option-text";

            optionText.textContent =
              String(
                question
                  ?.options
                  ?.[
                    option
                  ] ||
                ""
              );


            input.addEventListener(
              "change",
              () => {

                selectedAnswers[
                  index
                ] =
                  option;

                updateOptionVisual(
                  index
                );

                updateExamProgress();

              }
            );


            label.appendChild(
              input
            );

            label.appendChild(
              badge
            );

            label.appendChild(
              optionText
            );

            options.appendChild(
              label
            );

          }
        );


        row.appendChild(
          options
        );

        grid.appendChild(
          row
        );

      }
    );

  updateExamProgress();

}


/* =========================================================
   EXAM / OMR
   ========================================================= */

function renderExam() {

  const grid =
    $("examGrid");

  if (!grid) {
    return;
  }

  grid.innerHTML =
    "";

  selectedAnswers =
    new Array(
      currentQuestionCount
    ).fill("");

  currentExamPage =
    0;

  for (
    let i = 0;
    i < currentQuestionCount;
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
      String(
        i + 1
      );

    row.appendChild(
      number
    );

    const labels =
      getOptionLabels(
        currentOptions[i] ||
        4
      );

    labels.forEach(
      option => {

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
          option;

        const text =
          document.createElement(
            "span"
          );

        text.textContent =
          option;

        input.addEventListener(
          "change",
          () => {

            selectedAnswers[
              i
            ] =
              option;

            updateOptionVisual(
              i
            );

            updateExamProgress();

            updateQuestionNavigatorState();

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

    grid.appendChild(
      row
    );

  }

  renderQuestionNavigator();
  showExamPage(
    0
  );
  updateExamProgress();

}


/* =========================================================
   PDF EXAM QUESTION NAVIGATION
   ========================================================= */

function getExamPageCount() {

  return Math.max(
    1,
    Math.ceil(
      currentQuestionCount /
      QUESTIONS_PER_PAGE
    )
  );

}


function getExamPageStart(
  pageIndex
) {

  return (
    pageIndex *
    QUESTIONS_PER_PAGE
  );

}


function getExamPageEnd(
  pageIndex
) {

  return Math.min(
    currentQuestionCount,
    getExamPageStart(pageIndex) +
    QUESTIONS_PER_PAGE
  );

}


function renderQuestionNavigator() {

  const navigator =
    $("questionNavigator");

  const navGrid =
    $("questionNavGrid");

  const total =
    $("questionNavTotal");

  const current =
    $("questionNavCurrent");

  const prev =
    $("examPagePrevBtn");

  const next =
    $("examPageNextBtn");

  const indicator =
    $("examPageIndicator");

  if (!navigator || !navGrid) {
    return;
  }

  const pageCount =
    getExamPageCount();

  navGrid.innerHTML =
    "";

  for (
    let page = 0;
    page < pageCount;
    page++
  ) {

    const start =
      getExamPageStart(page) + 1;

    const end =
      getExamPageEnd(page);

    const button =
      document.createElement(
        "button"
      );

    button.type =
      "button";

    button.className =
      "question-nav-item";

    button.dataset.page =
      String(page);

    button.textContent =
      `${start}–${end}`;

    button.title =
      `Questions ${start} to ${end}`;

    button.setAttribute(
      "aria-label",
      `Questions ${start} to ${end}`
    );

    button.addEventListener(
      "click",
      () => {
        showExamPage(
          page
        );
      }
    );

    navGrid.appendChild(
      button
    );

  }

  if (total) {
    total.textContent =
      `${currentQuestionCount} Questions`;
  }

  updateQuestionNavigatorState();

  if (prev) {
    prev.addEventListener(
      "click",
      () => {
        showExamPage(
          currentExamPage - 1
        );
      }
    );
  }

  if (next) {
    next.addEventListener(
      "click",
      () => {
        showExamPage(
          currentExamPage + 1
        );
      }
    );
  }

  updateExamPageControls();

}


function updateQuestionNavigatorState() {

  const navGrid =
    $("questionNavGrid");

  if (!navGrid) {
    return;
  }

  [
    ...navGrid.querySelectorAll(
      ".question-nav-item"
    )
  ].forEach(
    (button, page) => {

      const start =
        getExamPageStart(page);

      const end =
        getExamPageEnd(page);

      const answered =
        selectedAnswers
          .slice(
            start,
            end
          )
          .some(
            Boolean
          );

      button.classList.toggle(
        "current",
        page === currentExamPage
      );

      button.classList.toggle(
        "answered",
        answered
      );

      button.classList.toggle(
        "unanswered",
        !answered
      );

      button.setAttribute(
        "aria-current",
        page === currentExamPage
          ? "true"
          : "false"
      );

    }
  );

}


function updateExamPageControls() {

  const pageCount =
    getExamPageCount();

  const start =
    currentQuestionCount > 0
      ? getExamPageStart(
          currentExamPage
        ) + 1
      : 0;

  const end =
    getExamPageEnd(
      currentExamPage
    );

  const current =
    $("questionNavCurrent");

  const indicator =
    $("examPageIndicator");

  const prev =
    $("examPagePrevBtn");

  const next =
    $("examPageNextBtn");

  if (current) {
    current.textContent =
      `${start}–${end}`;
  }

  if (indicator) {
    indicator.textContent =
      `${start}–${end}`;
  }

  if (prev) {
    prev.disabled =
      currentExamPage <= 0;
  }

  if (next) {
    next.disabled =
      currentExamPage >=
      pageCount - 1;
  }

}


function showExamPage(
  pageIndex
) {

  const pageCount =
    getExamPageCount();

  currentExamPage =
    Math.max(
      0,
      Math.min(
        pageCount - 1,
        Number(pageIndex) || 0
      )
    );

  const grid =
    $("examGrid");

  if (grid) {

    [
      ...grid.children
    ].forEach(
      (row, index) => {

        const page =
          Math.floor(
            index /
            QUESTIONS_PER_PAGE
          );

        row.hidden =
          page !==
          currentExamPage;

      }
    );

  }

  updateQuestionNavigatorState();
  updateExamPageControls();

  const active =
    $("questionNavGrid")
      ?.querySelector(
        `.question-nav-item[data-page="${currentExamPage}"]`
      );

  active?.scrollIntoView({
    behavior: "smooth",
    block: "nearest",
    inline: "center"
  });

}


/* =========================================================
   OPTION VISUAL
   ========================================================= */

function updateOptionVisual(
  questionIndex
) {

  document
    .querySelectorAll(
      `input[name="question-${questionIndex}"]`
    )
    .forEach(
      input => {

        const label =
          input.closest(
            ".answer-option"
          );

        if (!label) {
          return;
        }

        label.classList.toggle(
          "selected",
          input.checked
        );

      }
    );

}


/* =========================================================
   EXAM PROGRESS
   ========================================================= */

function updateExamProgress() {

  const answered =
    selectedAnswers.filter(
      Boolean
    ).length;

  const total =
    currentQuestionCount;

  if (
    $("questionProgress")
  ) {

    $("questionProgress")
      .textContent =
      `${answered} / ${total}`;

  }

  const percentage =
    total > 0
      ? (
          answered /
          total
        ) *
        100
      : 0;

  const fill =
    document.querySelector(
      ".progress-fill"
    );

  if (fill) {

    fill.style.width =
      `${percentage}%`;

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
          input => {

            input.checked =
              false;

          }
        );

      document
        .querySelectorAll(
          ".answer-option.selected"
        )
        .forEach(
          label => {

            label.classList.remove(
              "selected"
            );

          }
        );

      updateExamProgress();
      updateQuestionNavigatorState();

    }
  );


/* =========================================================
   RESULT CALCULATION
   ========================================================= */

function calculateResult() {

  const correctMark =
    Number(
      currentTest
        ?.correct_mark
    ) || 0;

  const wrongMark =
    Number(
      currentTest
        ?.wrong_mark
    ) || 0;

  let correct = 0;

  let wrong = 0;

  let unanswered = 0;


  for (
    let i = 0;
    i < currentQuestionCount;
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
      currentAnswerKey[i]
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
        ) *
        100
      : 0;


  return {

    testId:
      currentTest?.id ||
      null,

    testCode:
      currentTest?.code ||
      "",

    testName:
      currentTest?.name ||
      "",

    candidateName:
      $("candidateName")
        ?.value
        ?.trim() ||
      "",

    correct,

    wrong,

    unanswered,

    score,

    totalMarks,

    percentage,

    answers:
      [
        ...selectedAnswers
      ],

    answerKey:
      [
        ...currentAnswerKey
      ],

    options:
      [
        ...currentOptions
      ]

  };

}


/* =========================================================
   SAVE RESULT
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

  if (error) {
    throw error;
  }

}


/* =========================================================
   SUBMIT EXAM
   ========================================================= */

$("submitExamBtn")
  ?.addEventListener(
    "click",
    async () => {

      if (!currentTest) {
        return;
      }

      if (examSubmitted) {
        return;
      }


      const name =
        $("candidateName")
          ?.value
          ?.trim();


      if (!name) {

        alert(
          "Please enter your name before submitting."
        );

        $("candidateName")
          ?.focus();

        return;

      }


      const unanswered =
        selectedAnswers.filter(
          answer =>
            !answer
        ).length;


      if (
        unanswered > 0
      ) {

        const confirmSubmit =
          confirm(
            `${unanswered} question(s) are unanswered.\n\nSubmit anyway?`
          );

        if (!confirmSubmit) {
          return;
        }

      }


      setLoading(
        true,
        "Submitting examination..."
      );


      try {

        const result =
          calculateResult();


        await saveExamResult(
          result
        );


        examSubmitted =
          true;


        stopExamTimer();


        renderSubmittedResult(
          result
        );


        alert(
          "Exam submitted successfully."
        );


      } catch (error) {

        console.error(
          error
        );

        alert(
          "Could not submit the exam.\n\n" +
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
   RESULT
   ========================================================= */

function renderSubmittedResult(
  result
) {

  const box =
    $("resultBox");

  if (!box) {
    return;
  }

  box.innerHTML = `
    <div class="result-title">
      Exam Completed ✓
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

      <span>
        Score
      </span>

      <strong>
        ${result.score}
        /
        ${result.totalMarks}
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
   RESULT CHECK — ALL STUDENTS
   ========================================================= */

$("checkResultBtn")
  ?.addEventListener(
    "click",
    async () => {

      const code =
        $("resultCode")
          ?.value
          ?.trim()
          .toUpperCase();

      const status =
        $("resultStatus");

      const box =
        $("singleResultBox");

      clearStatus(
        status
      );

      hide(
        box
      );

      if (!code) {

        statusBox(
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
            );

        if (error) {
          throw error;
        }

        if (
          !data ||
          data.length === 0
        ) {
          throw new Error(
            "No submitted result found for this test code."
          );
        }

        const results =
          [...data].sort(
            (a, b) => {

              const scoreA =
                Number(
                  a.score
                ) || 0;

              const scoreB =
                Number(
                  b.score
                ) || 0;

              if (
                scoreB !== scoreA
              ) {
                return (
                  scoreB -
                  scoreA
                );
              }

              return (
                Number(
                  b.percentage
                ) || 0
              ) -
              (
                Number(
                  a.percentage
                ) || 0
              );

            }
          );

        if (!box) {
  return;
}

const testName =
  results[0]?.test_name ||
  "Examination";

const totalStudents =
  results.length;

const rows =
  results
    .map((result, index) => {
      const percentage =
        Number(result.percentage) || 0;

      return `
        <tr>
          <td>
            ${index + 1}
          </td>

          <td>
            <strong>
              ${escapeHtml(
                result.candidate_name ||
                "Candidate"
              )}
            </strong>
          </td>

          <td>
            ${result.correct ?? 0}
          </td>

          <td>
            ${result.wrong ?? 0}
          </td>

          <td>
            ${result.unanswered ?? 0}
          </td>

          <td>
            ${Number(
              result.score
            ).toFixed(2)}
            /
            ${Number(
              result.total_marks
            ).toFixed(2)}
          </td>

          <td>
            ${percentage.toFixed(2)}%
          </td>
        </tr>
      `;
    })
    .join("");

box.innerHTML = `
  <div class="result-title">
    Results Found ✓
  </div>

  <p>
    ${escapeHtml(testName)}
    •
    ${totalStudents}
    Student${totalStudents === 1 ? "" : "s"}
  </p>

  <div style="
    overflow-x:auto;
    width:100%;
    margin-top:18px;
  ">
    <table style="
      width:100%;
      min-width:720px;
      border-collapse:collapse;
      text-align:left;
    ">
      <thead>
        <tr>
          <th style="padding:12px;">Rank</th>
          <th style="padding:12px;">Student</th>
          <th style="padding:12px;">Correct</th>
          <th style="padding:12px;">Wrong</th>
          <th style="padding:12px;">Skipped</th>
          <th style="padding:12px;">Score</th>
          <th style="padding:12px;">Percentage</th>
        </tr>
      </thead>

      <tbody>
        ${rows}
      </tbody>
    </table>
  </div>
`;

show(box);

box.scrollIntoView({
  behavior:
    "smooth",
  block:
    "nearest"
});

      } catch (error) {

        console.error(
          error
        );

        statusBox(
          status,
          error.message ||
            "Could not load the result.",
          "error"
        );

      } finally {

        setLoading(
          false
        );

      }

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

        if (!button) {
          return;
        }

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
        !examSubmitted &&
        answered &&
        !confirm(
          "You have selected some answers.\n\nExit the exam?"
        )
      ) {

        return;

      }


      stopExamTimer();


      if (
        currentPdfDocument
      ) {

        try {

          await currentPdfDocument
            .destroy();

        } catch {}

      }


      currentPdfDocument =
        null;

      currentPdfUrl =
        "";

      currentTypedQuestions =
        [];

      currentExamPage =
        0;

      selectedAnswers =
        [];

      currentAnswerKey =
        [];

      currentOptions =
        [];

      currentTest =
        null;

      examSubmitted =
        false;


      setTypedExamPdfVisibility(
        false
      );


      showScreen(
        "homeScreen"
      );

    }
  );


/* =========================================================
   PDF VIEWER
   ========================================================= */

async function initializePdfViewer(
  url
) {

  const mount =
    $("pdfViewerMount");

  if (!mount) {
    return;
  }

  mount.innerHTML = `
    <div class="pdf-viewer">

      <div class="pdf-toolbar">

        <button
          type="button"
          id="pdfPrevBtn"
          class="small-btn secondary-btn"
          aria-label="Previous PDF page"
        >
          ‹
        </button>

        <span id="pdfPageInfo">
          1 / 1
        </span>

        <button
          type="button"
          id="pdfNextBtn"
          class="small-btn secondary-btn"
          aria-label="Next PDF page"
        >
          ›
        </button>

        <button
          type="button"
          id="pdfZoomOutBtn"
          class="small-btn secondary-btn"
          aria-label="Zoom out"
        >
          −
        </button>

        <span id="pdfZoomValue">
          100%
        </span>

        <button
          type="button"
          id="pdfZoomInBtn"
          class="small-btn secondary-btn"
          aria-label="Zoom in"
        >
          +
        </button>

      </div>

      <div
        id="pdfCanvasContainer"
        class="pdf-canvas-container"
      >
        <div
          id="pdfPages"
          class="pdf-pages"
        ></div>
      </div>

    </div>
  `;

  currentPdfUrl =
    url;

  const external =
    $("pdfExternalLink");

  if (external) {
    external.href =
      url;
  }

  try {

    const pdfjs =
      await loadPdfJs();

    currentPdfDocument =
      await pdfjs
        .getDocument({
          url,
          withCredentials:
            false
        })
        .promise;

    currentPdfPage =
      1;

    currentPdfScale =
      1;

    pdfPageCanvases =
      [];

    bindPdfControls();

    await renderPdfDocument();

  } catch (error) {

    console.error(
      "PDF viewer error:",
      error
    );

    mount.innerHTML = `
      <div class="status-box error">
        PDF preview could not be loaded.
        Use the Open PDF button below.
      </div>
    `;

  }

}


function bindPdfControls() {

  $("pdfPrevBtn")
    ?.addEventListener(
      "click",
      () => {

        if (
          !currentPdfDocument ||
          currentPdfPage <= 1
        ) {
          return;
        }

        currentPdfPage--;

        scrollToPdfPage(
          currentPdfPage
        );

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

        scrollToPdfPage(
          currentPdfPage
        );

      }
    );


  $("pdfZoomOutBtn")
    ?.addEventListener(
      "click",
      async () => {

        currentPdfScale =
          Math.max(
            0.5,
            currentPdfScale -
              0.1
          );

        updatePdfZoom();

        await renderPdfDocument();

      }
    );


  $("pdfZoomInBtn")
    ?.addEventListener(
      "click",
      async () => {

        currentPdfScale =
          Math.min(
            3,
            currentPdfScale +
              0.1
          );

        updatePdfZoom();

        await renderPdfDocument();

      }
    );

  const container =
    $("pdfCanvasContainer");

  container?.addEventListener(
    "scroll",
    () => {
      const wrappers =
        [
          ...container.querySelectorAll(
            ".pdf-page-wrapper"
          )
        ];

      if (!wrappers.length) {
        return;
      }

      const containerTop =
        container.getBoundingClientRect().top;

      let closestPage = 1;
      let closestDistance = Infinity;

      wrappers.forEach(
        wrapper => {
          const distance =
            Math.abs(
              wrapper.getBoundingClientRect().top -
              containerTop
            );

          if (distance < closestDistance) {
            closestDistance = distance;
            closestPage =
              Number(
                wrapper.dataset.page
              ) || 1;
          }
        }
      );

      currentPdfPage =
        closestPage;

      updatePdfPageInfo();
    },
    { passive: true }
  );

  updatePdfZoom();

}


function updatePdfZoom() {

  const value =
    $("pdfZoomValue");

  if (value) {
    value.textContent =
      `${Math.round(
        currentPdfScale *
        100
      )}%`;
  }

}


async function renderPdfDocument() {

  if (!currentPdfDocument) {
    return;
  }

  const container =
    $("pdfCanvasContainer");

  const pages =
    $("pdfPages");

  if (!container || !pages) {
    return;
  }

  const targetPage =
    currentPdfPage;

  pages.innerHTML =
    "";

  pdfPageCanvases =
    [];

  const firstPage =
    await currentPdfDocument
      .getPage(1);

  const baseViewport =
    firstPage.getViewport({
      scale: 1
    });

  const availableWidth =
    Math.max(
      280,
      container.clientWidth -
        36
    );

  const fitScale =
    availableWidth /
    baseViewport.width;

  const scale =
    fitScale *
    currentPdfScale;

  for (
    let pageNumber = 1;
    pageNumber <=
      currentPdfDocument.numPages;
    pageNumber++
  ) {

    const page =
      pageNumber === 1
        ? firstPage
        : await currentPdfDocument
            .getPage(
              pageNumber
            );

    const viewport =
      page.getViewport({
        scale
      });

    const wrapper =
      document.createElement(
        "div"
      );

    wrapper.className =
      "pdf-page-wrapper";

    wrapper.dataset.page =
      String(
        pageNumber
      );

    const canvas =
      document.createElement(
        "canvas"
      );

    canvas.className =
      "pdf-page-canvas";

    const dpr =
      window.devicePixelRatio ||
      1;

    canvas.width =
      Math.floor(
        viewport.width *
        dpr
      );

    canvas.height =
      Math.floor(
        viewport.height *
        dpr
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
      dpr,
      0,
      0,
      dpr,
      0,
      0
    );

    await page.render({
      canvasContext:
        context,
      viewport
    }).promise;

    wrapper.appendChild(
      canvas
    );

    pages.appendChild(
      wrapper
    );

    pdfPageCanvases.push(
      canvas
    );

  }

  currentPdfPage =
    Math.max(
      1,
      Math.min(
        targetPage,
        currentPdfDocument.numPages
      )
    );

  updatePdfPageInfo();

  scrollToPdfPage(
    currentPdfPage,
    false
  );

}


function updatePdfPageInfo() {

  const pageInfo =
    $("pdfPageInfo");

  if (pageInfo) {
    pageInfo.textContent =
      `${currentPdfPage} / ${currentPdfDocument?.numPages || 0}`;
  }

  const previous =
    $("pdfPrevBtn");

  const next =
    $("pdfNextBtn");

  if (previous) {
    previous.disabled =
      currentPdfPage <= 1;
  }

  if (next) {
    next.disabled =
      !currentPdfDocument ||
      currentPdfPage >=
        currentPdfDocument.numPages;
  }

}


function scrollToPdfPage(
  pageNumber,
  smooth = true
) {

  const container =
    $("pdfCanvasContainer");

  const wrapper =
    document.querySelector(
      `.pdf-page-wrapper[data-page="${pageNumber}"]`
    );

  if (!container || !wrapper) {
    return;
  }

  currentPdfPage =
    Math.max(
      1,
      Math.min(
        Number(pageNumber),
        currentPdfDocument?.numPages || 1
      )
    );

  wrapper.scrollIntoView({
    behavior:
      smooth
        ? "smooth"
        : "auto",
    block:
      "start",
    inline:
      "nearest"
  });

  updatePdfPageInfo();

}


/* =========================================================
   TIMER
   ========================================================= */

function startExamTimer(
  minutes
) {

  stopExamTimer();


  const timer =
    $("examTimer");

  const value =
    $("examTimerValue");


  if (
    !minutes ||
    minutes <= 0
  ) {

    hide(
      timer
    );

    return;

  }


  remainingSeconds =
    minutes *
    60;


  show(
    timer
  );


  updateTimerDisplay();


  timerInterval =
    setInterval(
      () => {

        remainingSeconds--;

        updateTimerDisplay();


        if (
          remainingSeconds <=
          0
        ) {

          stopExamTimer();


          if (
            !examSubmitted
          ) {

            alert(
              "Time is over. Your exam will be submitted."
            );

            $("submitExamBtn")
              ?.click();

          }

        }

      },
      1000
    );

}


function stopExamTimer() {

  if (
    timerInterval
  ) {

    clearInterval(
      timerInterval
    );

    timerInterval =
      null;

  }

}


function updateTimerDisplay() {

  const value =
    $("examTimerValue");

  if (!value) {
    return;
  }


  const minutes =
    Math.floor(
      remainingSeconds /
      60
    );


  const seconds =
    remainingSeconds %
    60;


  value.textContent =
    `${String(
      minutes
    ).padStart(
      2,
      "0"
    )}:${String(
      seconds
    ).padStart(
      2,
      "0"
    )}`;

}


/* =========================================================
   NAVIGATION
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


$("showResultBtn")
  ?.addEventListener(
    "click",
    () => {

      showScreen(
        "resultScreen"
      );

      $("resultCode")
        ?.focus();

    }
  );


$("backHomeFromResult")
  ?.addEventListener(
    "click",
    () =>
      showScreen(
        "homeScreen"
      )
  );


$("backHomeFromCreate")
  ?.addEventListener(
    "click",
    () =>
      showScreen(
        "homeScreen"
      )
  );


$("backHomeFromJoin")
  ?.addEventListener(
    "click",
    () =>
      showScreen(
        "homeScreen"
      )
  );


$("goHomeAfterCreate")
  ?.addEventListener(
    "click",
    () =>
      showScreen(
        "homeScreen"
      )
  );


/* =========================================================
   CREATE FORM
   ========================================================= */

$("questionCount")
  ?.addEventListener(
    "change",
    renderOptionSettings
  );


$("defaultOptions")
  ?.addEventListener(
    "change",
    () => {

      const value =
        Number(
          $("defaultOptions")
            ?.value
        ) === 2
          ? 2
          : 4;


      document
        .querySelectorAll(
          ".question-option-count"
        )
        .forEach(
          select => {

            select.value =
              String(
                value
              );

          }
        );

    }
  );


$("clearCreateBtn")
  ?.addEventListener(
    "click",
    () => {

      if ($("testName")) {

        $("testName")
          .value =
          "";

      }


      if ($("pdfFile")) {

        $("pdfFile")
          .value =
          "";

      }


      if ($("questionCount")) {

        $("questionCount")
          .value =
          "40";

      }


      if ($("defaultOptions")) {

        $("defaultOptions")
          .value =
          "4";

      }


      if ($("pdfStatus")) {

        $("pdfStatus")
          .textContent =
          "";

      }


      hide(
        $("pdfPreviewBox")
      );


      currentTest =
        null;

      currentOptions =
        [];

      currentAnswerKey =
        [];


      renderOptionSettings();

    }
  );


/* =========================================================
   JOIN CODE
   ========================================================= */

$("joinCode")
  ?.addEventListener(
    "input",
    event => {

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
    event => {

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


/* =========================================================
   THEME
   ========================================================= */

$("examoraThemeToggle")
  ?.addEventListener(
    "click",
    () => {

      const root =
        document.documentElement;

      const dark =
        root.getAttribute(
          "data-theme"
        ) === "dark";

      if (dark) {
        root.removeAttribute(
          "data-theme"
        );
      } else {
        root.setAttribute(
          "data-theme",
          "dark"
        );
      }

    }
  );


/* =========================================================
   INITIAL STATE
   ========================================================= */

document
  .querySelectorAll(
    ".screen"
  )
  .forEach(
    screen => {

      if (
        screen.id !==
        "homeScreen"
      ) {

        screen.classList.add(
          "hidden"
        );

      }

    }
  );