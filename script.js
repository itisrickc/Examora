/* =========================================================
   EXAM OMR
   FINAL MAIN JAVASCRIPT
   ========================================================= */


/* =========================================================
   SUPABASE CONFIGURATION
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
   STATE
   ========================================================= */

let currentTest = null;

let currentPdfUrl = "";

let currentQuestionCount = 40;

let currentOptions = [];

let currentAnswerKey = [];

let selectedAnswers = [];

let testCreatedCode = "";

let currentResult = null;

let candidateName = "";


/* =========================================================
   DOM HELPERS
   ========================================================= */

const $ = (id) =>
  document.getElementById(id);


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
  showLoading,
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

  if (showLoading) {
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

function showScreen(screenId) {
  const screens =
    document.querySelectorAll(
      ".screen"
    );

  screens.forEach(
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
   OPTION HELPERS
   ========================================================= */

function getOptionLabels(
  optionCount
) {
  return OPTION_LABELS.slice(
    0,
    normalizeOptionCount(
      optionCount
    )
  );
}


function normalizeOptionCount(
  value
) {
  const number =
    Number(value);

  return number === 2
    ? 2
    : 4;
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
    const randomIndex =
      Math.floor(
        Math.random() *
        characters.length
      );

    code +=
      characters[randomIndex];
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

  const defaultOptionCount =
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
        defaultOptionCount
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
  const selects =
    document.querySelectorAll(
      ".question-option-count"
    );

  return Array.from(
    selects
  ).map(
    (select) =>
      normalizeOptionCount(
        select.value
      )
  );
}


/* =========================================================
   PDF FILE SELECTION
   ========================================================= */

$("pdfFile")?.addEventListener(
  "change",
  (event) => {
    const file =
      event.target
        .files?.[0];

    const status =
      $("pdfStatus");

    const previewBox =
      $("pdfPreviewBox");

    const preview =
      $("pdfPreview");

    currentPdfUrl =
      "";

    hide(
      previewBox
    );

    if (!file) {
      if (status) {
        status.textContent =
          "";
      }

      if (preview) {
        preview.src =
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
          "";
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
    error: uploadError
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

  if (uploadError) {
    throw uploadError;
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
    !data ||
    !data.publicUrl
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
    i < currentQuestionCount;
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
        currentOptions[i] ||
          4
      );

    select.innerHTML =
      `<option value="">
        Select
      </option>` +
      labels
        .map(
          (label) =>
            `<option value="${label}">
              ${label}
            </option>`
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
  const selects =
    document.querySelectorAll(
      ".answer-key-select"
    );

  return Array.from(
    selects
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
        .trim();

    const pdfFile =
      $("pdfFile")
        ?.files?.[0];

    const questionCount =
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
        questionCount
      ) ||
      questionCount < 1 ||
      questionCount > 300
    ) {
      alert(
        "Question count must be between 1 and 300."
      );

      return;
    }

    currentQuestionCount =
      questionCount;

    currentOptions =
      collectQuestionOptions();

    if (
      currentOptions.length !==
      currentQuestionCount
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

      renderAnswerKey();

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

    const missingAnswers =
      answerKey.some(
        (answer) =>
          !answer
      );

    if (missingAnswers) {
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
      )
    ) {
      alert(
        "Please enter a valid correct mark."
      );

      return;
    }

    if (
      !Number.isFinite(
        wrongMark
      )
    ) {
      alert(
        "Please enter a valid wrong mark."
      );

      return;
    }

    setLoading(
      true,
      "Saving test..."
    );

    try {
      const payload = {
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
      };

      const {
        data,
        error
      } =
        await supabaseClient
          .from("tests")
          .insert(
            payload
          )
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
   PDF VIEWER
   IMPORTANT:
   ONLY ONE PDF VIEWER IS CREATED.
   ========================================================= */

function buildSinglePdfViewer(
  pdfUrl
) {
  const pdfCard =
    document.querySelector(
      "#examScreen .pdf-card"
    );

  if (!pdfCard) {
    return null;
  }

  /*
    Completely remove previous viewer UI.

    This prevents the old situation where:
    viewer #1 appeared at the top
    and viewer #2 appeared below it.
  */

  pdfCard.innerHTML =
    "";

  const header =
    document.createElement(
      "div"
    );

  header.className =
    "pdf-card-header";

  header.innerHTML = `
    <h3>
      Question Paper
    </h3>

    <span class="pdf-badge">
      PDF
    </span>
  `;

  const viewer =
    document.createElement(
      "div"
    );

  viewer.className =
    "pdf-viewer-container";

  const loading =
    document.createElement(
      "div"
    );

  loading.className =
    "pdf-loading-state";

  loading.innerHTML = `
    <div class="pdf-loader"></div>

    <p>
      Loading question paper...
    </p>
  `;

  const iframe =
    document.createElement(
      "iframe"
    );

  iframe.id =
    "examPdf";

  iframe.className =
    "pdf-viewer-frame";

  iframe.title =
    "Exam Question Paper";

  iframe.setAttribute(
    "loading",
    "eager"
  );

  iframe.setAttribute(
    "allow",
    "fullscreen"
  );

  iframe.setAttribute(
    "allowfullscreen",
    ""
  );

  /*
    Use the actual PDF URL directly.

    Chrome/Edge desktop:
    native PDF controls.

    Android:
    browser decides how the PDF is
    rendered without creating another
    artificial viewer.
  */

  iframe.src =
    pdfUrl;

  iframe.addEventListener(
    "load",
    () => {
      iframe.classList.add(
        "loaded"
      );

      loading.classList.add(
        "loaded"
      );
    }
  );

  viewer.appendChild(
    loading
  );

  viewer.appendChild(
    iframe
  );

  const footer =
    document.createElement(
      "div"
    );

  footer.className =
    "pdf-footer";

  footer.innerHTML = `
    <span>
      Question paper
    </span>

    <a
      href="${escapeAttribute(pdfUrl)}"
      target="_blank"
      rel="noopener noreferrer"
    >
      Open PDF
    </a>
  `;

  pdfCard.appendChild(
    header
  );

  pdfCard.appendChild(
    viewer
  );

  pdfCard.appendChild(
    footer
  );

  return iframe;
}


/* =========================================================
   PDF URL ESCAPE
   ========================================================= */

function escapeAttribute(
  value
) {
  return String(value)
    .replace(
      /&/g,
      "&amp;"
    )
    .replace(
      /"/g,
      "&quot;"
    )
    .replace(
      /'/g,
      "&#39;"
    )
    .replace(
      /</g,
      "&lt;"
    )
    .replace(
      />/g,
      "&gt;"
    );
}


/* =========================================================
   PDF INITIALIZATION
   ========================================================= */

async function initializePdfViewer(
  pdfUrl
) {
  if (!pdfUrl) {
    throw new Error(
      "Question paper PDF is not available."
    );
  }

  currentPdfUrl =
    pdfUrl;

  /*
    Force the browser to finish
    the current screen before rebuilding
    the PDF area.
  */

  await new Promise(
    (resolve) => {
      requestAnimationFrame(
        () => resolve()
      );
    }
  );

  buildSinglePdfViewer(
    pdfUrl
  );
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
    "candidate-card card";

  wrapper.innerHTML = `
    <div>
      <h3>
        Candidate
      </h3>

      <p>
        Enter your name before starting the exam.
      </p>
    </div>

    <div>
      <label
        for="candidateName"
      >
        Candidate Name
      </label>

      <input
        id="candidateName"
        type="text"
        maxlength="100"
        autocomplete="name"
        placeholder="Enter your full name"
      >
    </div>
  `;

  header.parentNode.insertBefore(
    wrapper,
    header.nextSibling
  );

  $("candidateName")
    ?.addEventListener(
      "input",
      (event) => {
        candidateName =
          event.target.value;
      }
    );
}


/* =========================================================
   JOIN TEST
   ========================================================= */

$("joinBtn")?.addEventListener(
  "click",
  async () => {
    const code =
      $("joinCode")
        ?.value
        .trim()
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

      currentPdfUrl =
        test.pdf_url;

      ensureCandidateNameInput();

      if (
        $("candidateName")
      ) {
        $("candidateName")
          .value =
          "";
      }

      hide(
        $("resultBox")
      );

      await initializePdfViewer(
        currentPdfUrl
      );

      renderExam();

      showScreen(
        "examScreen"
      );
    } catch (error) {
      console.error(
        error
      );

      showStatus(
        status,
        error.message,
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
   OMR
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
      i + 1;

    row.appendChild(
      number
    );

    const optionCount =
      currentOptions[i] ||
      4;

    const labels =
      getOptionLabels(
        optionCount
      );

    labels.forEach(
      (labelValue) => {
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
          labelValue;

        input.dataset.question =
          String(i);

        input.addEventListener(
          "change",
          () => {
            selectedAnswers[i] =
              input.value;

            updateSelectedOption(
              i,
              input.value
            );

            updateProgress();
          }
        );

        const text =
          document.createElement(
            "span"
          );

        text.textContent =
          labelValue;

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
   SELECTED OPTION
   ========================================================= */

function updateSelectedOption(
  questionIndex,
  selectedValue
) {
  const inputs =
    document.querySelectorAll(
      `input[name="question-${questionIndex}"]`
    );

  inputs.forEach(
    (input) => {
      const label =
        input.closest(
          ".answer-option"
        );

      if (!label) {
        return;
      }

      if (
        input.value ===
        selectedValue
      ) {
        label.classList.add(
          "selected"
        );
      } else {
        label.classList.remove(
          "selected"
        );
      }
    }
  );
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

  const progress =
    $("questionProgress");

  if (progress) {
    progress.textContent =
      `${answered} / ${total}`;
  }
}


/* =========================================================
   SUBMIT EXAM
   ========================================================= */

$("submitExamBtn")?.addEventListener(
  "click",
  async () => {
    if (!currentTest) {
      return;
    }

    const unanswered =
      selectedAnswers.filter(
        (answer) =>
          !answer
      ).length;

    if (
      unanswered > 0
    ) {
      const proceed =
        confirm(
          `${unanswered} question(s) are unanswered.\n\nSubmit anyway?`
        );

      if (!proceed) {
        return;
      }
    }

    const name =
      $("candidateName")
        ?.value
        ?.trim() ||
      candidateName.trim();

    if (!name) {
      alert(
        "Please enter your name before submitting."
      );

      $("candidateName")
        ?.focus();

      return;
    }

    candidateName =
      name;

    await calculateAndSaveResult();
  }
);


/* =========================================================
   CALCULATE RESULT
   ========================================================= */

async function calculateAndSaveResult() {
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
    i < currentQuestionCount;
    i++
  ) {
    const selected =
      selectedAnswers[i];

    const correctAnswer =
      answerKey[i];

    if (!selected) {
      unanswered++;
      continue;
    }

    if (
      selected ===
      correctAnswer
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

  const result = {
    test_code:
      currentTest.code,

    candidate_name:
      candidateName,

    answers:
      selectedAnswers,

    correct_count:
      correct,

    wrong_count:
      wrong,

    unanswered_count:
      unanswered,

    score:
      score,

    total_marks:
      totalMarks,

    percentage:
      percentage
  };

  currentResult =
    result;

  renderResult(
    result
  );

  await saveResult(
    result
  );
}


/* =========================================================
   SAVE RESULT TO SUPABASE
   ========================================================= */

async function saveResult(
  result
) {
  const saveStatus =
    document.getElementById(
      "resultSaveStatus"
    );

  if (saveStatus) {
    saveStatus.className =
      "result-save-status";

    saveStatus.textContent =
      "Saving result...";
  }

  try {
    const {
      error
    } =
      await supabaseClient
        .from("results")
        .insert({
          test_code:
            result.test_code,

          candidate_name:
            result.candidate_name,

          answers:
            result.answers,

          correct_count:
            result.correct_count,

          wrong_count:
            result.wrong_count,

          unanswered_count:
            result.unanswered_count,

          score:
            result.score,

          total_marks:
            result.total_marks,

          percentage:
            result.percentage
        });

    if (error) {
      throw error;
    }

    if (saveStatus) {
      saveStatus.className =
        "result-save-status success";

      saveStatus.textContent =
        "✓ Result saved successfully.";
    }
  } catch (error) {
    console.error(
      "Result save error:",
      error
    );

    if (saveStatus) {
      saveStatus.className =
        "result-save-status warning";

      saveStatus.textContent =
        "Result calculated, but could not be saved.";
    }
  }
}


/* =========================================================
   RESULT UI
   ========================================================= */

function renderResult(
  result
) {
  const resultBox =
    $("resultBox");

  if (!resultBox) {
    return;
  }

  resultBox.innerHTML = `
    <div class="result-title">
      Result
    </div>

    <div class="result-stats">

      <div class="result-stat">
        <span>
          Correct
        </span>

        <strong>
          ${result.correct_count}
        </strong>
      </div>

      <div class="result-stat">
        <span>
          Wrong
        </span>

        <strong>
          ${result.wrong_count}
        </strong>
      </div>

      <div class="result-stat">
        <span>
          Unanswered
        </span>

        <strong>
          ${result.unanswered_count}
        </strong>
      </div>

      <div class="result-stat">
        <span>
          Percentage
        </span>

        <strong>
          ${Number(
            result.percentage
          ).toFixed(2)}%
        </strong>
      </div>

    </div>

    <div class="score-display">

      <span>
        Score
      </span>

      <strong>
        ${formatNumber(
          result.score
        )}
        /
        ${formatNumber(
          result.total_marks
        )}
      </strong>

    </div>

    <div
      id="resultSaveStatus"
      class="result-save-status"
    >
      Saving result...
    </div>
  `;

  show(
    resultBox
  );

  resultBox.scrollIntoView({
    behavior:
      "smooth",

    block:
      "nearest"
  });
}


/* =========================================================
   NUMBER FORMAT
   ========================================================= */

function formatNumber(
  number
) {
  return Number(number)
    .toFixed(2)
    .replace(
      /\.00$/,
      ""
    );
}


/* =========================================================
   RESET EXAM
   ========================================================= */

$("resetExamBtn")?.addEventListener(
  "click",
  () => {
    const confirmed =
      confirm(
        "Are you sure you want to clear all answers?"
      );

    if (!confirmed) {
      return;
    }

    selectedAnswers =
      new Array(
        currentQuestionCount
      ).fill("");

    const inputs =
      document.querySelectorAll(
        "#examGrid input[type='radio']"
      );

    inputs.forEach(
      (input) => {
        input.checked =
          false;

        const label =
          input.closest(
            ".answer-option"
          );

        if (label) {
          label.classList.remove(
            "selected"
          );
        }
      }
    );

    hide(
      $("resultBox")
    );

    updateProgress();
  }
);


/* =========================================================
   COPY TEST CODE
   ========================================================= */

$("copyCodeBtn")?.addEventListener(
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

      $("copyCodeBtn")
        .textContent =
        "Copied!";

      setTimeout(
        () => {
          $("copyCodeBtn")
            .textContent =
            "Copy Code";
        },
        1500
      );
    } catch (error) {
      alert(
        `Test Code: ${code}`
      );
    }
  }
);


/* =========================================================
   NAVIGATION
   ========================================================= */

$("showCreateBtn")?.addEventListener(
  "click",
  () => {
    resetCreateForm();

    showScreen(
      "createScreen"
    );
  }
);


$("showJoinBtn")?.addEventListener(
  "click",
  () => {
    if ($("joinCode")) {
      $("joinCode")
        .value =
        "";
    }

    hideStatus(
      $("joinStatus")
    );

    showScreen(
      "joinScreen"
    );
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


$("backToCreateBtn")
  ?.addEventListener(
    "click",
    () => {
      showScreen(
        "createScreen"
      );
    }
  );


$("goHomeAfterCreate")
  ?.addEventListener(
    "click",
    () => {
      resetCreateForm();

      showScreen(
        "homeScreen"
      );
    }
  );


/* =========================================================
   EXIT EXAM
   ========================================================= */

$("exitExamBtn")?.addEventListener(
  "click",
  () => {
    const confirmed =
      confirm(
        "Leave this test?"
      );

    if (!confirmed) {
      return;
    }

    currentTest =
      null;

    currentPdfUrl =
      "";

    selectedAnswers =
      [];

    currentResult =
      null;

    candidateName =
      "";

    showScreen(
      "homeScreen"
    );
  }
);


/* =========================================================
   CLEAR CREATE FORM
   ========================================================= */

function resetCreateForm() {
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

    $("pdfStatus")
      .style
      .color =
      "";
  }

  if ($("pdfPreview")) {
    $("pdfPreview")
      .src =
      "";
  }

  hide(
    $("pdfPreviewBox")
  );

  currentPdfUrl =
    "";

  currentTest =
    null;

  currentOptions =
    [];

  currentAnswerKey =
    [];

  testCreatedCode =
    "";

  renderOptionSettings();
}


$("clearCreateBtn")
  ?.addEventListener(
    "click",
    () => {
      const confirmed =
        confirm(
          "Clear all test creation data?"
        );

      if (!confirmed) {
        return;
      }

      resetCreateForm();
    }
  );


/* =========================================================
   QUESTION COUNT CHANGE
   ========================================================= */

$("questionCount")
  ?.addEventListener(
    "input",
    () => {
      const count =
        Number(
          $("questionCount")
            .value
        );

      if (
        !Number.isInteger(
          count
        ) ||
        count < 1 ||
        count > 300
      ) {
        return;
      }

      renderOptionSettings();
    }
  );


/* =========================================================
   DEFAULT OPTION CHANGE
   ========================================================= */

$("defaultOptions")
  ?.addEventListener(
    "change",
    () => {
      renderOptionSettings();
    }
  );


/* =========================================================
   JOIN CODE INPUT
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
        $("joinBtn")
          ?.click();
      }
    }
  );


/* =========================================================
   SAFETY:
   REMOVE OLD / DUPLICATE PDF VIEWERS
   ========================================================= */

function cleanupOldPdfViewers() {
  const pdfCards =
    document.querySelectorAll(
      "#examScreen .pdf-card"
    );

  pdfCards.forEach(
    (card) => {
      /*
        Do not remove the actual card here
        because buildSinglePdfViewer()
        will rebuild it when an exam starts.
      */

      const iframes =
        card.querySelectorAll(
          "iframe"
        );

      if (
        iframes.length > 1
      ) {
        /*
          Keep the original #examPdf
          only until the real viewer is
          rebuilt.
        */

        let keep =
          card.querySelector(
            "#examPdf"
          );

        if (!keep) {
          keep =
            iframes[0];
        }

        iframes.forEach(
          (frame) => {
            if (
              frame !== keep
            ) {
              frame.remove();
            }
          }
        );
      }
    }
  );
}


/* =========================================================
   INITIALIZATION
   ========================================================= */

function initializeApp() {
  cleanupOldPdfViewers();

  renderOptionSettings();

  showScreen(
    "homeScreen"
  );

  console.log(
    "Exam OMR initialized — Final Version."
  );
}


initializeApp();