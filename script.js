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

const STORAGE_BUCKET = "question-papers";

const PDFJS_VERSION = "4.10.38";

const PDFJS_URL =
  `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.min.mjs`;

const PDFJS_WORKER =
  `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.mjs`;

const OPTION_LABELS = ["A", "B", "C", "D"];


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

let pdfModule = null;

let timerInterval = null;

let remainingSeconds = 0;

let examSubmitted = false;


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
    element.classList.remove("hidden");
  }
}

function hide(element) {
  if (element) {
    element.classList.add("hidden");
  }
}

function showScreen(id) {
  document
    .querySelectorAll(".screen")
    .forEach((screen) => {
      screen.classList.add("hidden");
    });

  const screen = $(id);

  if (screen) {
    screen.classList.remove("hidden");
  }

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

function setLoading(active, message) {
  const overlay = $("loadingOverlay");
  const text = $("loadingText");

  if (text && message) {
    text.textContent = message;
  }

  if (active) {
    show(overlay);
  } else {
    hide(overlay);
  }
}

function statusBox(element, message, type) {
  if (!element) return;

  element.textContent = message;

  element.className =
    "status-box";

  if (type) {
    element.classList.add(type);
  }

  show(element);
}

function clearStatus(element) {
  hide(element);

  if (element) {
    element.textContent = "";
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}


/* =========================================================
   OPTION HELPERS
   ========================================================= */

function normalizeOptionCount(value) {
  return Number(value) === 2
    ? 2
    : 4;
}

function getOptionLabels(count) {
  return OPTION_LABELS.slice(
    0,
    normalizeOptionCount(count)
  );
}


/* =========================================================
   TEST CODE
   ========================================================= */

function generateTestCode() {
  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  let result = "";

  for (let i = 0; i < 6; i++) {
    result +=
      chars[
        Math.floor(
          Math.random() *
          chars.length
        )
      ];
  }

  return result;
}

async function generateUniqueTestCode() {
  for (let i = 0; i < 15; i++) {
    const code =
      generateTestCode();

    const {
      data,
      error
    } = await supabaseClient
      .from("tests")
      .select("id")
      .eq("code", code)
      .limit(1);

    if (error) {
      throw error;
    }

    if (!data || data.length === 0) {
      return code;
    }
  }

  throw new Error(
    "Could not generate a unique test code."
  );
}


/* =========================================================
   OPTION SETTINGS
   ========================================================= */

function renderOptionSettings() {
  const container =
    $("optionSettings");

  if (!container) return;

  const count =
    Math.max(
      1,
      Math.min(
        300,
        Number(
          $("questionCount")?.value
        ) || 40
      )
    );

  const defaultOptions =
    normalizeOptionCount(
      $("defaultOptions")?.value
    );

  container.innerHTML = "";

  for (let i = 0; i < count; i++) {
    const item =
      document.createElement("div");

    item.className =
      "option-setting";

    item.innerHTML = `
      <div class="option-setting-number">
        ${i + 1}
      </div>

      <select
        class="question-option-count"
        data-question="${i}"
      >
        <option
          value="4"
          ${
            defaultOptions === 4
              ? "selected"
              : ""
          }
        >
          4 Options
        </option>

        <option
          value="2"
          ${
            defaultOptions === 2
              ? "selected"
              : ""
          }
        >
          2 Options
        </option>
      </select>
    `;

    container.appendChild(item);
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
   PDF UPLOAD
   ========================================================= */

async function uploadQuestionPaper(
  file,
  code
) {
  if (!file) {
    throw new Error(
      "Please select a PDF."
    );
  }

  const fileName =
    `${code}-${Date.now()}.pdf`;

  const {
    error
  } = await supabaseClient
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

  if (error) {
    throw error;
  }

  const {
    data
  } = supabaseClient
    .storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(
      fileName
    );

  if (!data?.publicUrl) {
    throw new Error(
      "Could not create PDF URL."
    );
  }

  return data.publicUrl;
}


/* =========================================================
   PDF FILE INPUT
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

    if (!file) {
      hide(previewBox);

      if (status) {
        status.textContent = "";
      }

      return;
    }

    if (
      file.type !==
      "application/pdf"
    ) {
      event.target.value = "";

      statusBox(
        status,
        "Please select a PDF file.",
        "error"
      );

      return;
    }

    if (preview) {
      preview.src =
        URL.createObjectURL(file);
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
   ANSWER KEY
   ========================================================= */

function renderAnswerKey() {
  const container =
    $("answerKeyGrid");

  if (!container) return;

  container.innerHTML = "";

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
      document.createElement("div");

    item.className =
      "answer-key-item";

    const title =
      document.createElement("strong");

    title.textContent =
      `Question ${i + 1}`;

    const select =
      document.createElement("select");

    select.className =
      "answer-key-select";

    select.dataset.question =
      String(i);

    const labels =
      getOptionLabels(
        currentOptions[i] || 4
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

    item.appendChild(title);
    item.appendChild(select);

    container.appendChild(item);
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
   QUICK ANSWER KEY
   ========================================================= */

function parseQuickAnswerKey(text) {
  const input =
    String(text || "")
      .trim()
      .toUpperCase();

  if (!input) {
    return [];
  }

  const result = [];

  /*
    Supports:

    A B C D A B
    A,C,B,D
    1-A 2-C 3-B
    1:A 2:C 3:B
    Q1-A Q2-C
  */

  const numbered =
    /(?:Q)?(\d+)\s*[-:=]\s*([ABCD])/g;

  let match;

  while (
    (match =
      numbered.exec(input)) !== null
  ) {
    result[
      Number(match[1]) - 1
    ] =
      match[2];
  }

  if (
    result.length === 0
  ) {
    const letters =
      input.match(
        /[ABCD]/g
      ) || [];

    return letters;
  }

  return result;
}

$("applyQuickKeyBtn")?.addEventListener(
  "click",
  () => {
    const status =
      $("quickKeyStatus");

    const text =
      $("quickAnswerKey")
        ?.value || "";

    const parsed =
      parseQuickAnswerKey(text);

    if (
      parsed.length === 0
    ) {
      statusBox(
        status,
        "Could not find any valid answers.",
        "error"
      );

      return;
    }

    let applied = 0;

    document
      .querySelectorAll(
        ".answer-key-select"
      )
      .forEach(
        (select, index) => {
          const answer =
            parsed[index];

          if (
            answer &&
            getOptionLabels(
              currentOptions[index]
            ).includes(answer)
          ) {
            select.value =
              answer;

            currentAnswerKey[index] =
              answer;

            applied++;
          }
        }
      );

    statusBox(
      status,
      `Applied ${applied} answer(s).`,
      "success"
    );
  }
);

$("clearQuickKeyBtn")?.addEventListener(
  "click",
  () => {
    if ($("quickAnswerKey")) {
      $("quickAnswerKey").value = "";
    }

    clearStatus(
      $("quickKeyStatus")
    );
  }
);


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
      !Number.isInteger(count) ||
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
          currentOptions,
        duration_minutes:
          Number(
            $("durationMinutes")
              ?.value
          ) || 0
      };

      renderAnswerKey();

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
      statusBox(
        $("saveStatus"),
        "Please select the correct answer for every question.",
        "error"
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
      statusBox(
        $("saveStatus"),
        "Please enter valid marks.",
        "error"
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
      } = await supabaseClient
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
            currentTest.duration_minutes
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
      console.error(error);

      statusBox(
        $("saveStatus"),
        error.message ||
          "Could not save test.",
        "error"
      );

    } finally {
      setLoading(false);
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
    String(code || "")
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
  } = await supabaseClient
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

$("joinBtn")?.addEventListener(
  "click",
  async () => {
    const code =
      $("joinCode")
        ?.value
        ?.trim()
        .toUpperCase();

    const status =
      $("joinStatus");

    clearStatus(status);

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

      examSubmitted = false;

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
          .value = "";
      }

      showScreen(
        "examScreen"
      );

      renderExam();

      await initializePdfViewer(
        currentTest.pdf_url
      );

      startExamTimer(
        Number(
          currentTest.duration_minutes
        ) || 0
      );

    } catch (error) {
      console.error(error);

      statusBox(
        status,
        error.message ||
          "Could not load test.",
        "error"
      );

    } finally {
      setLoading(false);
    }
  }
);


/* =========================================================
   EXAM / OMR
   ========================================================= */

function renderExam() {
  const grid =
    $("examGrid");

  if (!grid) return;

  grid.innerHTML = "";

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
      document.createElement("div");

    row.className =
      "exam-question";

    const number =
      document.createElement("div");

    number.className =
      "question-number";

    number.textContent =
      String(i + 1);

    row.appendChild(number);

    const labels =
      getOptionLabels(
        currentOptions[i] || 4
      );

    labels.forEach(
      (option) => {
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
            selectedAnswers[i] =
              option;

            updateOptionVisual(
              i
            );

            updateExamProgress();
          }
        );

        label.appendChild(input);
        label.appendChild(text);

        row.appendChild(label);
      }
    );

    grid.appendChild(row);
  }

  updateExamProgress();
}

function updateOptionVisual(
  questionIndex
) {
  document
    .querySelectorAll(
      `input[name="question-${questionIndex}"]`
    )
    .forEach(
      (input) => {
        const label =
          input.closest(
            ".answer-option"
          );

        if (!label) return;

        label.classList.toggle(
          "selected",
          input.checked
        );
      }
    );
}

function updateExamProgress() {
  const answered =
    selectedAnswers.filter(
      Boolean
    ).length;

  const total =
    currentQuestionCount;

  if ($("questionProgress")) {
    $("questionProgress")
      .textContent =
      `${answered} / ${total}`;
  }

  const percentage =
    total > 0
      ? (
          answered /
          total
        ) * 100
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

$("resetExamBtn")?.addEventListener(
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
        }
      );

    document
      .querySelectorAll(
        ".answer-option.selected"
      )
      .forEach(
        (label) => {
          label.classList.remove(
            "selected"
          );
        }
      );

    updateExamProgress();
  }
);


/* =========================================================
   RESULT CALCULATION
   ========================================================= */

function calculateResult() {
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
        ) * 100
      : 0;

  return {
  candidateName:
    $("candidateName")
      ?.value
      ?.trim() || "",

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
   SAVE RESULT
   ========================================================= */

async function saveExamResult(result) {
  if (!result) {
    throw new Error("Result data is missing.");
  }

  /*
    IMPORTANT:
    The current exam_results table does NOT have
    an "answers" column.

    So we only save the columns that exist:
      test_code
      test_name
      candidate_name
      correct
      wrong
      unanswered
      score
      total_marks
      percentage
  */

  const payload = {
    test_code:
      result.testCode || "",

    test_name:
      result.testName ||
      currentTest?.name ||
      "Online Examination",

    candidate_name:
      result.candidateName ||
      "Candidate",

    correct:
      Number(result.correct) || 0,

    wrong:
      Number(result.wrong) || 0,

    unanswered:
      Number(result.unanswered) || 0,

    score:
      Number(result.score) || 0,

    total_marks:
      Number(result.totalMarks) || 0,

    percentage:
      Number(result.percentage) || 0
  };

  console.log(
    "Saving exam result:",
    payload
  );

  const {
    error
  } = await supabaseClient
    .from("exam_results")
    .insert(payload);

  if (error) {
    console.error(
      "Exam result save error:",
      error
    );

    throw error;
  }

  console.log(
    "Exam result saved successfully."
  );

  return true;
}

/* =========================================================
   SHOW RESULT AFTER SUBMIT
   ========================================================= */

function renderSubmittedResult(
  result
) {
  const box =
    $("resultBox");

  if (!box) return;

  box.innerHTML = `
    <div class="result-title">
      Result
    </div>

    <p>
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
        ${result.score}
        /
        ${result.totalMarks}
      </strong>

    </div>
  `;

  show(box);

  box.scrollIntoView({
    behavior: "smooth",
    block: "nearest"
  });
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
        (answer) => !answer
      ).length;

    if (unanswered > 0) {
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

      examSubmitted = true;

      stopExamTimer();

      renderSubmittedResult(
        result
      );

      alert(
        "Exam submitted successfully."
      );

    } catch (error) {
      console.error(error);

      alert(
        "Could not submit the exam.\n\n" +
        error.message
      );

    } finally {
      setLoading(false);
    }
  }
);

/* =========================================================
   RESULT CHECK — ALL STUDENTS
   ========================================================= */

$("checkResultBtn")?.addEventListener(
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

    clearStatus(status);
    hide(box);

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
      "Loading all student results..."
    );

    try {
      /* -----------------------------------------
         FETCH ALL RESULTS FOR THIS TEST
         ----------------------------------------- */

      const {
        data,
        error
      } = await supabaseClient
        .from("exam_results")
        .select("*")
        .eq(
          "test_code",
          code
        )
        .order(
          "score",
          {
            ascending: false
          }
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

      /* -----------------------------------------
         SORT RESULTS
         Highest score first.
         If scores are equal, percentage decides.
         ----------------------------------------- */

      const results =
        [...data].sort(
          (a, b) => {
            const scoreA =
              Number(a.score) || 0;

            const scoreB =
              Number(b.score) || 0;

            if (
              scoreB !== scoreA
            ) {
              return scoreB - scoreA;
            }

            const percentageA =
              Number(a.percentage) || 0;

            const percentageB =
              Number(b.percentage) || 0;

            return (
              percentageB -
              percentageA
            );
          }
        );

      /* -----------------------------------------
         BUILD RESULT TABLE
         ----------------------------------------- */

      let tableRows = "";

      results.forEach(
        (result, index) => {
          const rank =
            index + 1;

          const candidate =
            escapeHtml(
              result.candidate_name ||
              "Candidate"
            );

          const correct =
            Number(
              result.correct
            ) || 0;

          const wrong =
            Number(
              result.wrong
            ) || 0;

          const unanswered =
            Number(
              result.unanswered
            ) || 0;

          const score =
            Number(
              result.score
            ) || 0;

          const totalMarks =
            Number(
              result.total_marks
            ) || 0;

          const percentage =
            Number(
              result.percentage
            ) || 0;

          tableRows += `
            <tr>
              <td
                style="
                  text-align:center;
                  font-weight:700;
                  white-space:nowrap;
                "
              >
                ${rank}
              </td>

              <td
                style="
                  font-weight:600;
                  min-width:160px;
                "
              >
                ${candidate}
              </td>

              <td
                style="
                  text-align:center;
                  color:#15803d;
                  font-weight:700;
                "
              >
                ${correct}
              </td>

              <td
                style="
                  text-align:center;
                  color:#dc2626;
                  font-weight:700;
                "
              >
                ${wrong}
              </td>

              <td
                style="
                  text-align:center;
                  color:#64748b;
                  font-weight:700;
                "
              >
                ${unanswered}
              </td>

              <td
                style="
                  text-align:center;
                  font-weight:800;
                  white-space:nowrap;
                "
              >
                ${score} / ${totalMarks}
              </td>

              <td
                style="
                  text-align:center;
                  font-weight:800;
                  color:#0f766e;
                  white-space:nowrap;
                "
              >
                ${percentage.toFixed(2)}%
              </td>
            </tr>
          `;
        }
      );

      /* -----------------------------------------
         TEST NAME
         ----------------------------------------- */

      const testName =
        escapeHtml(
          results[0]?.test_name ||
          "Online Examination"
        );

      /* -----------------------------------------
         FINAL RESULT UI
         ----------------------------------------- */

      if (box) {
        box.innerHTML = `
          <div class="result-title">
            Result Found
          </div>

          <p>
            <strong>
              ${testName}
            </strong>
          </p>

          <p>
            <strong>
              Test Code:
            </strong>
            ${escapeHtml(code)}
          </p>

          <p
            style="
              margin-top:8px;
              margin-bottom:18px;
              color:#64748b;
            "
          >
            ${results.length}
            student(s) submitted this examination.
          </p>

          <div
            style="
              width:100%;
              overflow-x:auto;
              border:1px solid #dbe5e7;
              border-radius:14px;
              background:#ffffff;
            "
          >
            <table
              style="
                width:100%;
                min-width:760px;
                border-collapse:collapse;
                font-size:14px;
              "
            >
              <thead>
                <tr
                  style="
                    background:#f0fdfa;
                    border-bottom:2px solid #d5eeee;
                  "
                >
                  <th
                    style="
                      padding:13px 10px;
                      text-align:center;
                    "
                  >
                    Rank
                  </th>

                  <th
                    style="
                      padding:13px 10px;
                      text-align:left;
                    "
                  >
                    Student
                  </th>

                  <th
                    style="
                      padding:13px 10px;
                      text-align:center;
                    "
                  >
                    Correct
                  </th>

                  <th
                    style="
                      padding:13px 10px;
                      text-align:center;
                    "
                  >
                    Wrong
                  </th>

                  <th
                    style="
                      padding:13px 10px;
                      text-align:center;
                    "
                  >
                    Unanswered
                  </th>

                  <th
                    style="
                      padding:13px 10px;
                      text-align:center;
                    "
                  >
                    Score
                  </th>

                  <th
                    style="
                      padding:13px 10px;
                      text-align:center;
                    "
                  >
                    Percentage
                  </th>
                </tr>
              </thead>

              <tbody>
                ${tableRows}
              </tbody>
            </table>
          </div>
        `;

        show(box);

        box.scrollIntoView({
          behavior: "smooth",
          block: "nearest"
        });
      }

    } catch (error) {
      console.error(
        "Result check error:",
        error
      );

      statusBox(
        status,
        error.message ||
          "Could not check results.",
        "error"
      );

    } finally {
      setLoading(false);
    }
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
        >
          ›
        </button>

        <button
          type="button"
          id="pdfZoomOutBtn"
          class="small-btn secondary-btn"
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
        >
          +
        </button>

      </div>

      <div
        id="pdfCanvasContainer"
        style="
          width:100%;
          overflow:auto;
          -webkit-overflow-scrolling:touch;
          text-align:center;
        "
      >
        <canvas
          id="pdfCanvas"
        ></canvas>
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

    currentPdfPage = 1;

    currentPdfScale = 1;

    bindPdfControls();

    await renderPdfPage();

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
  $("pdfPrevBtn")?.addEventListener(
    "click",
    async () => {
      if (
        currentPdfPage <= 1
      ) {
        return;
      }

      currentPdfPage--;

      await renderPdfPage();
    }
  );

  $("pdfNextBtn")?.addEventListener(
    "click",
    async () => {
      if (
        !currentPdfDocument ||
        currentPdfPage >=
          currentPdfDocument.numPages
      ) {
        return;
      }

      currentPdfPage++;

      await renderPdfPage();
    }
  );

  $("pdfZoomOutBtn")?.addEventListener(
    "click",
    async () => {
      currentPdfScale =
        Math.max(
          0.5,
          currentPdfScale - 0.1
        );

      updatePdfZoom();

      await renderPdfPage();
    }
  );

  $("pdfZoomInBtn")?.addEventListener(
    "click",
    async () => {
      currentPdfScale =
        Math.min(
          3,
          currentPdfScale + 0.1
        );

      updatePdfZoom();

      await renderPdfPage();
    }
  );

  updatePdfZoom();
}

function updatePdfZoom() {
  const value =
    $("pdfZoomValue");

  if (value) {
    value.textContent =
      `${Math.round(
        currentPdfScale * 100
      )}%`;
  }
}

async function renderPdfPage() {
  if (!currentPdfDocument) {
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

  const page =
    await currentPdfDocument
      .getPage(
        currentPdfPage
      );

  const baseViewport =
    page.getViewport({
      scale: 1
    });

  const availableWidth =
    Math.max(
      280,
      container.clientWidth - 20
    );

  const fitScale =
    availableWidth /
    baseViewport.width;

  const scale =
    fitScale *
    currentPdfScale;

  const viewport =
    page.getViewport({
      scale
    });

  const dpr =
    window.devicePixelRatio || 1;

  canvas.width =
    Math.floor(
      viewport.width * dpr
    );

  canvas.height =
    Math.floor(
      viewport.height * dpr
    );

  canvas.style.width =
    `${viewport.width}px`;

  canvas.style.height =
    `${viewport.height}px`;

  const context =
    canvas.getContext("2d");

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

  const pageInfo =
    $("pdfPageInfo");

  if (pageInfo) {
    pageInfo.textContent =
      `${currentPdfPage} / ${currentPdfDocument.numPages}`;
  }
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
    hide(timer);
    return;
  }

  remainingSeconds =
    minutes * 60;

  show(timer);

  updateTimerDisplay();

  timerInterval =
    setInterval(
      () => {
        remainingSeconds--;

        updateTimerDisplay();

        if (
          remainingSeconds <= 0
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
  if (timerInterval) {
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

  if (!value) return;

  const minutes =
    Math.floor(
      remainingSeconds / 60
    );

  const seconds =
    remainingSeconds % 60;

  value.textContent =
    `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}


/* =========================================================
   NAVIGATION
   ========================================================= */

$("showCreateBtn")?.addEventListener(
  "click",
  () => {
    showScreen(
      "createScreen"
    );

    renderOptionSettings();
  }
);

$("showJoinBtn")?.addEventListener(
  "click",
  () => {
    showScreen(
      "joinScreen"
    );

    $("joinCode")
      ?.focus();
  }
);

$("showResultBtn")?.addEventListener(
  "click",
  () => {
    showScreen(
      "resultScreen"
    );

    $("resultCode")
      ?.focus();
  }
);

$("backHomeFromCreate")?.addEventListener(
  "click",
  () => {
    showScreen(
      "homeScreen"
    );
  }
);

$("backHomeFromJoin")?.addEventListener(
  "click",
  () => {
    showScreen(
      "homeScreen"
    );
  }
);

$("backHomeFromResult")?.addEventListener(
  "click",
  () => {
    showScreen(
      "homeScreen"
    );
  }
);

$("backToCreateBtn")?.addEventListener(
  "click",
  () => {
    showScreen(
      "createScreen"
    );
  }
);

$("goHomeAfterCreate")?.addEventListener(
  "click",
  () => {
    showScreen(
      "homeScreen"
    );
  }
);


/* =========================================================
   COPY CODE
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
      await navigator.clipboard
        .writeText(code);

      const button =
        $("copyCodeBtn");

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
   CLEAR CREATE FORM
   ========================================================= */

$("clearCreateBtn")?.addEventListener(
  "click",
  () => {
    if ($("testName")) {
      $("testName").value = "";
    }

    if ($("pdfFile")) {
      $("pdfFile").value = "";
    }

    if ($("questionCount")) {
      $("questionCount").value =
        "40";
    }

    if ($("defaultOptions")) {
      $("defaultOptions").value =
        "4";
    }

    if ($("durationMinutes")) {
      $("durationMinutes").value =
        "60";
    }

    if ($("pdfStatus")) {
      $("pdfStatus").textContent =
        "";
    }

    hide(
      $("pdfPreviewBox")
    );

    currentTest = null;
    currentOptions = [];
    currentAnswerKey = [];

    renderOptionSettings();
  }
);


/* =========================================================
   CREATE FORM CHANGES
   ========================================================= */

$("questionCount")?.addEventListener(
  "change",
  () => {
    renderOptionSettings();
  }
);

$("defaultOptions")?.addEventListener(
  "change",
  () => {
    renderOptionSettings();
  }
);


/* =========================================================
   JOIN CODE FORMAT
   ========================================================= */

$("joinCode")?.addEventListener(
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

$("resultCode")?.addEventListener(
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


/* =========================================================
   ENTER KEY
   ========================================================= */

$("joinCode")?.addEventListener(
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

$("resultCode")?.addEventListener(
  "keydown",
  (event) => {
    if (
      event.key ===
      "Enter"
    ) {
      event.preventDefault();

      $("checkResultBtn")
        ?.click();
    }
  }
);


/* =========================================================
   EXIT EXAM
   ========================================================= */

$("exitExamBtn")?.addEventListener(
  "click",
  () => {
    const answered =
      selectedAnswers.filter(
        Boolean
      ).length;

    if (
      answered > 0 &&
      !examSubmitted
    ) {
      const ok =
        confirm(
          "You have selected answers.\n\nExit the exam?"
        );

      if (!ok) {
        return;
      }
    }

    stopExamTimer();

    currentPdfDocument =
      null;

    currentPdfUrl =
      "";

    selectedAnswers =
      [];

    examSubmitted =
      false;

    showScreen(
      "homeScreen"
    );
  }
);


/* =========================================================
   INITIALIZATION
   ========================================================= */

function initializeApp() {
  renderOptionSettings();

  showScreen(
    "homeScreen"
  );
}

if (
  document.readyState ===
  "loading"
) {
  document.addEventListener(
    "DOMContentLoaded",
    initializeApp,
    {
      once: true
    }
  );
} else {
  initializeApp();
}


/* =========================================================
   ERROR LOGGING
   ========================================================= */

window.addEventListener(
  "unhandledrejection",
  (event) => {
    console.error(
      "Unhandled promise rejection:",
      event.reason
    );
  }
);

window.addEventListener(
  "error",
  (event) => {
    console.error(
      "JavaScript error:",
      event.error ||
        event.message
    );
  }
);


/* =========================================================
   END
   ========================================================= */