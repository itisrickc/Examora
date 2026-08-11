/* =========================================================
   EXAM OMR
   Main JavaScript
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

const STORAGE_BUCKET = "question-papers";

const OPTION_LABELS = ["A", "B", "C", "D"];

const RESULTS_TABLE = "results";


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


/* =========================================================
   DOM HELPERS
   ========================================================= */

const $ = (id) =>
  document.getElementById(id);


function show(element) {
  if (element) {
    element.classList.remove("hidden");
  }
}


function hide(element) {
  if (element) {
    element.classList.add("hidden");
  }
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
    loadingText.textContent = text;
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

  element.textContent = message;

  element.className =
    "status-box";

  if (type) {
    element.classList.add(type);
  }

  show(element);
}


function hideStatus(element) {
  if (!element) {
    return;
  }

  hide(element);
}


function showScreen(screenId) {
  const screens =
    document.querySelectorAll(
      ".screen"
    );

  screens.forEach((screen) => {
    hide(screen);
  });

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
   TEST CODE
   ========================================================= */

function generateTestCode() {
  const characters =
    "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  let code = "";

  for (let i = 0; i < 6; i++) {
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
    attempt < 10;
    attempt++
  ) {
    const code =
      generateTestCode();

    const { data, error } =
      await supabaseClient
        .from("tests")
        .select("id")
        .eq("code", code)
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
   OPTION HELPERS
   ========================================================= */

function getOptionLabels(
  optionCount
) {
  return OPTION_LABELS.slice(
    0,
    optionCount
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
   CREATE TEST
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
          $("questionCount").value
        ) || 40
      )
    );

  const defaultOptionCount =
    normalizeOptionCount(
      $("defaultOptions").value
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
  ).map((select) =>
    normalizeOptionCount(
      select.value
    )
  );
}


/* =========================================================
   PDF FILE PREVIEW
   ========================================================= */

if ($("pdfFile")) {
  $("pdfFile").addEventListener(
    "change",
    (event) => {
      const file =
        event.target.files[0];

      const status =
        $("pdfStatus");

      const previewBox =
        $("pdfPreviewBox");

      const preview =
        $("pdfPreview");

      currentPdfUrl =
        "";

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

      const localUrl =
        URL.createObjectURL(
          file
        );

      if (preview) {
        preview.src =
          localUrl;
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
}


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

  const { error:
    uploadError
  } =
    await supabaseClient
      .storage
      .from(STORAGE_BUCKET)
      .upload(
        fileName,
        file,
        {
          cacheControl: "3600",
          upsert: false,
          contentType:
            "application/pdf"
        }
      );

  if (uploadError) {
    throw uploadError;
  }

  const { data } =
    supabaseClient
      .storage
      .from(STORAGE_BUCKET)
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

    const optionCount =
      currentOptions[i] || 4;

    const labels =
      getOptionLabels(
        optionCount
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
   CREATE TEST BUTTON
   ========================================================= */

if ($("generateBtn")) {
  $("generateBtn").addEventListener(
    "click",
    async () => {
      const name =
        $("testName")
          .value
          .trim();

      const pdfFile =
        $("pdfFile")
          .files[0];

      const questionCount =
        Number(
          $("questionCount")
            .value
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
        console.error(error);

        alert(
          "Could not prepare the test.\n\n" +
          error.message
        );
      } finally {
        setLoading(false);
      }
    }
  );
}


/* =========================================================
   SAVE TEST
   ========================================================= */

if ($("saveTestBtn")) {
  $("saveTestBtn").addEventListener(
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
            .value
        );

      const wrongMark =
        Number(
          $("wrongMark")
            .value
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

        $("createdCode")
          .textContent =
          testCreatedCode;

        showScreen(
          "createdScreen"
        );
      } catch (error) {
        console.error(error);

        alert(
          "Could not save the test.\n\n" +
          error.message
        );
      } finally {
        setLoading(false);
      }
    }
  );
}


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
   JOIN TEST
   ========================================================= */

if ($("joinBtn")) {
  $("joinBtn").addEventListener(
    "click",
    async () => {
      const code =
        $("joinCode")
          .value
          .trim()
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

        $("examName")
          .textContent =
          test.name;

        $("examInfo")
          .textContent =
          `${currentQuestionCount} Questions • Code: ${test.code}`;

        renderExamPdf(
          test.pdf_url
        );

        renderExam();

        ensureCandidateNameField();

        showScreen(
          "examScreen"
        );
      } catch (error) {
        console.error(error);

        showStatus(
          status,
          error.message,
          "error"
        );
      } finally {
        setLoading(false);
      }
    }
  );
}


/* =========================================================
   EXAM PDF
   ========================================================= */

function renderExamPdf(
  pdfUrl
) {
  const pdf =
    $("examPdf");

  if (!pdf) {
    return;
  }

  pdf.src =
    pdfUrl;

  let openButton =
    $("openPdfButton");

  if (!openButton) {
    openButton =
      document.createElement(
        "a"
      );

    openButton.id =
      "openPdfButton";

    openButton.className =
      "secondary-btn full-btn";

    openButton.target =
      "_blank";

    openButton.rel =
      "noopener";

    openButton.textContent =
      "Open Question Paper";

    pdf.parentElement.appendChild(
      openButton
    );
  }

  openButton.href =
    pdfUrl;
}


/* =========================================================
   CANDIDATE NAME
   ========================================================= */

function ensureCandidateNameField() {
  const omrHeader =
    document.querySelector(
      ".omr-header"
    );

  if (!omrHeader) {
    return;
  }

  let existing =
    $("candidateNameField");

  if (existing) {
    return;
  }

  const wrapper =
    document.createElement(
      "div"
    );

  wrapper.id =
    "candidateNameWrapper";

  wrapper.style.marginBottom =
    "16px";

  wrapper.innerHTML = `
    <label
      for="candidateNameField"
      style="margin-top:0;"
    >
      Candidate Name
    </label>

    <input
      id="candidateNameField"
      type="text"
      placeholder="Enter your full name"
      autocomplete="name"
    >
  `;

  omrHeader.parentElement.insertBefore(
    wrapper,
    omrHeader.nextSibling
  );
}


/* =========================================================
   EXAM OMR
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
      currentOptions[i] || 4;

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

        label.appendChild(
          input
        );

        const text =
          document.createElement(
            "span"
          );

        text.textContent =
          labelValue;

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

if ($("submitExamBtn")) {
  $("submitExamBtn").addEventListener(
    "click",
    async () => {
      if (!currentTest) {
        return;
      }

      const nameInput =
        $("candidateNameField");

      const candidateName =
        nameInput
          ? nameInput.value.trim()
          : "";

      if (!candidateName) {
        alert(
          "Please enter your name before submitting."
        );

        if (nameInput) {
          nameInput.focus();
        }

        return;
      }

      const unanswered =
        selectedAnswers.filter(
          (answer) =>
            !answer
        ).length;

      if (unanswered > 0) {
        const proceed =
          confirm(
            `${unanswered} question(s) are unanswered.\n\nSubmit anyway?`
          );

        if (!proceed) {
          return;
        }
      }

      await calculateResult(
        candidateName
      );
    }
  );
}


/* =========================================================
   CALCULATE RESULT
   ========================================================= */

async function calculateResult(
  candidateName
) {
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
        ) * 100
      : 0;

  const result = {
    candidateName,
    correct,
    wrong,
    unanswered,
    score,
    totalMarks,
    percentage
  };

  setLoading(
    true,
    "Saving your result..."
  );

  try {
    await saveResult(
      result
    );

    renderResult(
      result
    );
  } catch (error) {
    console.error(error);

    alert(
      "Your result could not be saved.\n\n" +
      error.message
    );
  } finally {
    setLoading(false);
  }
}


/* =========================================================
   SAVE RESULT TO SUPABASE
   ========================================================= */

async function saveResult(
  result
) {
  const payload = {
    test_code:
      currentTest.code,

    candidate_name:
      result.candidateName,

    answers:
      selectedAnswers,

    correct_count:
      result.correct,

    wrong_count:
      result.wrong,

    unanswered_count:
      result.unanswered,

    score:
      result.score,

    total_marks:
      result.totalMarks,

    percentage:
      result.percentage
  };

  const {
    error
  } =
    await supabaseClient
      .from(
        RESULTS_TABLE
      )
      .insert(
        payload
      );

  if (error) {
    throw error;
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

    <p>
      Candidate:
      <strong>
        ${escapeHtml(
          result.candidateName
        )}
      </strong>
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

  show(resultBox);

  resultBox.scrollIntoView({
    behavior:
      "smooth",
    block:
      "nearest"
  });
}


/* =========================================================
   FORMATTERS
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


function escapeHtml(
  value
) {
  return String(
    value
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
   RESET EXAM
   ========================================================= */

if ($("resetExamBtn")) {
  $("resetExamBtn").addEventListener(
    "click",
    () => {
      const confirmed =
        confirm(
          "Are you sure you want to delete all selected answers?"
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
          ".answer-option input"
        );

      inputs.forEach(
        (input) => {
          input.checked =
            false;
        }
      );

      const labels =
        document.querySelectorAll(
          ".answer-option"
        );

      labels.forEach(
        (label) => {
          label.classList.remove(
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
}


/* =========================================================
   HOME / NAVIGATION
   ========================================================= */

if ($("showCreateBtn")) {
  $("showCreateBtn")
    .addEventListener(
      "click",
      () => {
        showScreen(
          "createScreen"
        );

        renderOptionSettings();
      }
    );
}


if ($("showJoinBtn")) {
  $("showJoinBtn")
    .addEventListener(
      "click",
      () => {
        showScreen(
          "joinScreen"
        );
      }
    );
}


if ($("backHomeFromCreate")) {
  $("backHomeFromCreate")
    .addEventListener(
      "click",
      () => {
        showScreen(
          "homeScreen"
        );
      }
    );
}


if ($("backHomeFromJoin")) {
  $("backHomeFromJoin")
    .addEventListener(
      "click",
      () => {
        showScreen(
          "homeScreen"
        );
      }
    );
}


if ($("backToCreateBtn")) {
  $("backToCreateBtn")
    .addEventListener(
      "click",
      () => {
        showScreen(
          "createScreen"
        );
      }
    );
}


if ($("goHomeAfterCreate")) {
  $("goHomeAfterCreate")
    .addEventListener(
      "click",
      () => {
        showScreen(
          "homeScreen"
        );
      }
    );
}


if ($("exitExamBtn")) {
  $("exitExamBtn")
    .addEventListener(
      "click",
      () => {
        const confirmed =
          confirm(
            "Exit this exam?"
          );

        if (!confirmed) {
          return;
        }

        currentTest =
          null;

        selectedAnswers =
          [];

        showScreen(
          "homeScreen"
        );
      }
    );
}


/* =========================================================
   COPY TEST CODE
   ========================================================= */

if ($("copyCodeBtn")) {
  $("copyCodeBtn")
    .addEventListener(
      "click",
      async () => {
        const code =
          $("createdCode")
            .textContent
            .trim();

        try {
          await navigator.clipboard.writeText(
            code
          );

          alert(
            "Test code copied!"
          );
        } catch (error) {
          console.error(error);

          alert(
            `Test Code: ${code}`
          );
        }
      }
    );
}


/* =========================================================
   CLEAR CREATE FORM
   ========================================================= */

if ($("clearCreateBtn")) {
  $("clearCreateBtn")
    .addEventListener(
      "click",
      () => {
        if ($("testName")) {
          $("testName").value =
            "";
        }

        if ($("pdfFile")) {
          $("pdfFile").value =
            "";
        }

        if ($("pdfStatus")) {
          $("pdfStatus").textContent =
            "";
        }

        hide(
          $("pdfPreviewBox")
        );

        if ($("questionCount")) {
          $("questionCount").value =
            40;
        }

        if ($("defaultOptions")) {
          $("defaultOptions").value =
            "4";
        }

        currentPdfUrl =
          "";

        currentOptions =
          [];

        renderOptionSettings();
      }
    );
}


/* =========================================================
   RESULT SCREENS
   ========================================================= */

/*
   IMPORTANT:
   These screens are created dynamically.

   This prevents duplicate buttons from appearing
   in the existing index.html.
*/

function createResultScreens() {
  removeDuplicateDynamicResultElements();

  const main =
    document.querySelector(
      "main.container"
    );

  if (!main) {
    return;
  }

  /* =========================
     CHECK SINGLE RESULT
     ========================= */

  const resultScreen =
    document.createElement(
      "section"
    );

  resultScreen.id =
    "checkResultScreen";

  resultScreen.className =
    "screen hidden";

  resultScreen.innerHTML = `
    <div class="card join-card">

      <button
        id="backHomeFromResult"
        class="small-btn secondary-btn"
      >
        ← Back
      </button>

      <h2>
        Check Result
      </h2>

      <p>
        Enter the test code and candidate name
        to view the result.
      </p>

      <label>
        Test Code
      </label>

      <input
        id="resultTestCode"
        type="text"
        maxlength="6"
        placeholder="E.g.: Q226B9"
        autocomplete="off"
      >

      <label>
        Candidate Name
      </label>

      <input
        id="resultCandidateName"
        type="text"
        placeholder="Enter candidate name"
        autocomplete="off"
      >

      <button
        id="checkSingleResultBtn"
        class="primary-btn full-btn"
        style="margin-top:18px;"
      >
        Check Result
      </button>

      <div
        id="singleResultOutput"
        class="result-box hidden"
      ></div>

      <div
        id="singleResultStatus"
        class="status-box hidden"
      ></div>

    </div>
  `;

  main.appendChild(
    resultScreen
  );


  /* =========================
     CHECK ALL RESULTS
     ========================= */

  const allResultsScreen =
    document.createElement(
      "section"
    );

  allResultsScreen.id =
    "checkResultsScreen";

  allResultsScreen.className =
    "screen hidden";

  allResultsScreen.innerHTML = `
    <div class="card">

      <div class="section-header">

        <div>
          <h2>
            Check Results
          </h2>

          <p>
            Enter the test code to view
            all submitted candidates.
          </p>
        </div>

        <button
          id="backHomeFromResults"
          class="small-btn secondary-btn"
        >
          ← Back
        </button>

      </div>

      <input
        id="allResultsTestCode"
        type="text"
        maxlength="6"
        placeholder="Enter Test Code"
        autocomplete="off"
      >

      <button
        id="checkAllResultsBtn"
        class="primary-btn"
        style="margin-top:14px;"
      >
        View All Results
      </button>

      <div
        id="allResultsStatus"
        class="status-box hidden"
      ></div>

      <div
        id="allResultsOutput"
        style="margin-top:18px;"
      ></div>

    </div>
  `;

  main.appendChild(
    allResultsScreen
  );


  attachResultNavigation();
}


/* =========================================================
   REMOVE DUPLICATE DYNAMIC ELEMENTS
   ========================================================= */

function removeDuplicateDynamicResultElements() {
  const dynamicIds = [
    "checkResultScreen",
    "checkResultsScreen"
  ];

  dynamicIds.forEach(
    (id) => {
      const elements =
        document.querySelectorAll(
          `#${id}`
        );

      if (
        elements.length > 1
      ) {
        for (
          let i = 1;
          i < elements.length;
          i++
        ) {
          elements[i].remove();
        }
      }
    }
  );

  const homeActions =
    document.querySelector(
      ".home-actions"
    );

  if (!homeActions) {
    return;
  }

  /*
     Remove old dynamically-created result buttons.
     We identify them using their IDs.
  */

  [
    "dynamicCheckResultBtn",
    "dynamicCheckResultsBtn"
  ].forEach(
    (id) => {
      const element =
        $(id);

      if (element) {
        element.remove();
      }
    }
  );

  /*
     Remove duplicate result buttons that may
     have been generated by an older version.
  */

  const buttons =
    Array.from(
      homeActions.querySelectorAll(
        "button"
      )
    );

  const resultButtons =
    buttons.filter(
      (button) => {
        const text =
          button.textContent
            .trim()
            .toLowerCase();

        return (
          text ===
            "check result" ||
          text ===
            "check results"
        );
      }
    );

  /*
     The old dynamically-generated buttons
     are removed completely.
  */

  resultButtons.forEach(
    (button) => {
      button.remove();
    }
  );
}


/* =========================================================
   CREATE ONLY TWO HOME RESULT BUTTONS
   ========================================================= */

function createHomeResultButtons() {
  const homeActions =
    document.querySelector(
      ".home-actions"
    );

  if (!homeActions) {
    return;
  }

  /*
     Remove any previous result buttons.
  */

  homeActions
    .querySelectorAll(
      ".result-home-button"
    )
    .forEach(
      (button) =>
        button.remove()
    );

  /*
     Remove old buttons by text.
  */

  Array.from(
    homeActions.querySelectorAll(
      "button"
    )
  ).forEach(
    (button) => {
      const text =
        button.textContent
          .trim()
          .toLowerCase();

      if (
        text ===
          "check result" ||
        text ===
          "check results"
      ) {
        button.remove();
      }
    }
  );


  /* =========================
     SINGLE RESULT
     ========================= */

  const singleButton =
    document.createElement(
      "button"
    );

  singleButton.id =
    "dynamicCheckResultBtn";

  singleButton.className =
    "secondary-btn full-btn result-home-button";

  singleButton.textContent =
    "Check Result";


  /* =========================
     ALL RESULTS
     ========================= */

  const allButton =
    document.createElement(
      "button"
    );

  allButton.id =
    "dynamicCheckResultsBtn";

  allButton.className =
    "secondary-btn full-btn result-home-button";

  allButton.textContent =
    "Check Results";


  homeActions.appendChild(
    singleButton
  );

  homeActions.appendChild(
    allButton
  );


  singleButton.addEventListener(
    "click",
    () => {
      showScreen(
        "checkResultScreen"
      );
    }
  );


  allButton.addEventListener(
    "click",
    () => {
      showScreen(
        "checkResultsScreen"
      );
    }
  );
}


/* =========================================================
   RESULT NAVIGATION
   ========================================================= */

function attachResultNavigation() {
  if ($("backHomeFromResult")) {
    $("backHomeFromResult")
      .addEventListener(
        "click",
        () => {
          showScreen(
            "homeScreen"
          );
        }
      );
  }


  if ($("backHomeFromResults")) {
    $("backHomeFromResults")
      .addEventListener(
        "click",
        () => {
          showScreen(
            "homeScreen"
          );
        }
      );
  }


  if ($("checkSingleResultBtn")) {
    $("checkSingleResultBtn")
      .addEventListener(
        "click",
        checkSingleResult
      );
  }


  if ($("checkAllResultsBtn")) {
    $("checkAllResultsBtn")
      .addEventListener(
        "click",
        checkAllResults
      );
  }
}


/* =========================================================
   CHECK ONE RESULT
   ========================================================= */

async function checkSingleResult() {
  const code =
    $("resultTestCode")
      .value
      .trim()
      .toUpperCase();

  const candidateName =
    $("resultCandidateName")
      .value
      .trim();

  const status =
    $("singleResultStatus");

  const output =
    $("singleResultOutput");

  hideStatus(status);

  hide(output);

  if (!code) {
    showStatus(
      status,
      "Please enter the test code.",
      "error"
    );

    return;
  }

  if (!candidateName) {
    showStatus(
      status,
      "Please enter the candidate name.",
      "error"
    );

    return;
  }

  setLoading(
    true,
    "Checking result..."
  );

  try {
    const {
      data,
      error
    } =
      await supabaseClient
        .from(
          RESULTS_TABLE
        )
        .select("*")
        .eq(
          "test_code",
          code
        )
        .ilike(
          "candidate_name",
          candidateName
        )
        .order(
          "submitted_at",
          {
            ascending:
              false
          }
        )
        .limit(1);

    if (error) {
      throw error;
    }

    if (
      !data ||
      data.length === 0
    ) {
      showStatus(
        status,
        "No result found. Check the test code and candidate name.",
        "error"
      );

      return;
    }

    const result =
      data[0];

    renderSingleCheckedResult(
      result
    );

    show(output);
  } catch (error) {
    console.error(error);

    showStatus(
      status,
      error.message,
      "error"
    );
  } finally {
    setLoading(false);
  }
}


/* =========================================================
   SINGLE RESULT DISPLAY
   ========================================================= */

function renderSingleCheckedResult(
  result
) {
  const output =
    $("singleResultOutput");

  if (!output) {
    return;
  }

  output.innerHTML = `
    <div class="result-title">
      ${escapeHtml(
        result.candidate_name
      )}
    </div>

    <div class="result-stats">

      <div class="result-stat">
        <span>Correct</span>
        <strong>
          ${result.correct_count}
        </strong>
      </div>

      <div class="result-stat">
        <span>Wrong</span>
        <strong>
          ${result.wrong_count}
        </strong>
      </div>

      <div class="result-stat">
        <span>Unanswered</span>
        <strong>
          ${result.unanswered_count}
        </strong>
      </div>

      <div class="result-stat">
        <span>Percentage</span>
        <strong>
          ${formatNumber(
            result.percentage
          )}%
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
  `;
}


/* =========================================================
   CHECK ALL RESULTS
   ========================================================= */

async function checkAllResults() {
  const code =
    $("allResultsTestCode")
      .value
      .trim()
      .toUpperCase();

  const status =
    $("allResultsStatus");

  const output =
    $("allResultsOutput");

  hideStatus(status);

  output.innerHTML =
    "";

  if (!code) {
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
    const {
      data,
      error
    } =
      await supabaseClient
        .from(
          RESULTS_TABLE
        )
        .select(
          `
            candidate_name,
            correct_count,
            wrong_count,
            unanswered_count,
            score,
            total_marks,
            percentage,
            submitted_at
          `
        )
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

    if (error) {
      throw error;
    }

    if (
      !data ||
      data.length === 0
    ) {
      showStatus(
        status,
        "No submitted results found for this test code.",
        "error"
      );

      return;
    }

    renderAllResults(
      data,
      code
    );
  } catch (error) {
    console.error(error);

    showStatus(
      status,
      error.message,
      "error"
    );
  } finally {
    setLoading(false);
  }
}


/* =========================================================
   ALL RESULTS DISPLAY
   ========================================================= */

function renderAllResults(
  results,
  code
) {
  const output =
    $("allResultsOutput");

  if (!output) {
    return;
  }

  const rows =
    results
      .map(
        (result, index) => `
          <tr>

            <td>
              ${index + 1}
            </td>

            <td>
              ${escapeHtml(
                result.candidate_name
              )}
            </td>

            <td>
              ${result.correct_count}
            </td>

            <td>
              ${result.wrong_count}
            </td>

            <td>
              ${result.unanswered_count}
            </td>

            <td>
              <strong>
                ${formatNumber(
                  result.score
                )}
              </strong>
              /
              ${formatNumber(
                result.total_marks
              )}
            </td>

            <td>
              ${formatNumber(
                result.percentage
              )}%
            </td>

          </tr>
        `
      )
      .join("");

  output.innerHTML = `
    <div
      style="
        overflow-x:auto;
        border:1px solid var(--border);
        border-radius:12px;
      "
    >

      <table
        style="
          width:100%;
          border-collapse:collapse;
          background:#ffffff;
          min-width:700px;
        "
      >

        <thead>
          <tr>
            <th>#</th>
            <th>Candidate</th>
            <th>Correct</th>
            <th>Wrong</th>
            <th>Unanswered</th>
            <th>Score</th>
            <th>Percentage</th>
          </tr>
        </thead>

        <tbody>
          ${rows}
        </tbody>

      </table>

    </div>

    <p
      style="
        margin-top:12px;
        font-size:13px;
      "
    >
      Test Code:
      <strong>
        ${escapeHtml(code)}
      </strong>
      •
      ${results.length}
      candidate(s)
    </p>
  `;

  addResultTableStyles();
}


/* =========================================================
   RESULT TABLE STYLES
   ========================================================= */

function addResultTableStyles() {
  if (
    $("resultTableStyles")
  ) {
    return;
  }

  const style =
    document.createElement(
      "style"
    );

  style.id =
    "resultTableStyles";

  style.textContent = `
    #allResultsOutput table th,
    #allResultsOutput table td {
      padding: 11px 12px;
      text-align: left;
      border-bottom: 1px solid var(--border);
      white-space: nowrap;
    }

    #allResultsOutput table th {
      font-size: 12px;
      color: var(--muted);
      background: #fafafa;
    }

    #allResultsOutput table td {
      font-size: 13px;
    }

    #allResultsOutput table tr:last-child td {
      border-bottom: none;
    }

    #allResultsOutput table tbody tr:hover {
      background: #faf9ff;
    }

    #openPdfButton {
      display: block;
      margin-top: 12px;
      text-align: center;
      text-decoration: none;
    }

    #candidateNameWrapper input {
      width: 100%;
    }

    @media (max-width: 650px) {
      #allResultsOutput table {
        min-width: 680px;
      }
    }
  `;

  document.head.appendChild(
    style
  );
}


/* =========================================================
   INITIALIZE
   ========================================================= */

function initializeApp() {
  /*
     Create result pages first.
  */

  createResultScreens();

  /*
     Create exactly two result buttons.
  */

  createHomeResultButtons();

  /*
     Render default question options.
  */

  if (
    $("optionSettings") &&
    $("questionCount")
  ) {
    renderOptionSettings();
  }
}


/* =========================================================
   START
   ========================================================= */

if (
  document.readyState ===
  "loading"
) {
  document.addEventListener(
    "DOMContentLoaded",
    initializeApp
  );
} else {
  initializeApp();
}