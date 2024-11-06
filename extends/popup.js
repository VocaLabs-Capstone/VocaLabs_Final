document.getElementById("crawl-content").addEventListener("click", () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.scripting.executeScript(
      {
        target: { tabId: tabs[0].id },
        function: getFilteredMainContent,
      },
      (results) => {
        const mainContent = results[0].result || "No main content found!";

        // 텍스트박스에 본문 내용 표시 (사용자가 수정 가능)
        document.getElementById("content-display").value = mainContent;
      }
    );
  });
});

document.getElementById("summarize-content").addEventListener("click", () => {
  // 텍스트박스에서 내용을 가져옵니다.
  const content = document.getElementById("content-display").value;

  if (!content) {
    alert("Please crawl content first.");
    return;
  }

  // EXP442/pegasus_summarizer 모델을 사용하여 요약
  fetch("https://api-inference.huggingface.co/models/google/pegasus-xsum", {
    method: "POST",
    headers: {
      Authorization: "Bearer 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", // 실제 토큰으로 교체
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ inputs: content }),
  })
    .then((response) => {
      if (!response.ok) {
        console.error("API 호출 실패:", response.status, response.statusText);
        document.getElementById("summary-display").value =
          "API 호출 실패: " + response.status;
        return null;
      }
      return response.json();
    })
    .then((data) => {
      console.log("API 응답 데이터:", data); // 응답 데이터 전체 출력

      if (data && data[0] && data[0].summary_text) {
        // Pegasus 모델의 경우 summary_text 필드를 사용합니다.
        document.getElementById("summary-display").value = data[0].summary_text;
      } else {
        document.getElementById("summary-display").value =
          "Summary could not be generated.";
        console.warn("summary_text 필드가 응답에 없습니다.");
      }
    })
    .catch((error) => {
      console.error("Error summarizing content:", error);
      document.getElementById("summary-display").value =
        "Failed to summarize content.";
    });
});

function getFilteredMainContent() {
  const mainElement =
    document.querySelector("main") ||
    document.querySelector("article") ||
    document.querySelector('div[role="main"]');

  if (mainElement) {
    const mainClone = mainElement.cloneNode(true);

    const elementsToRemove = mainClone.querySelectorAll(
      "nav, aside, footer, header, .sidebar, .advertisement, .ad, .footer, " +
        ".social, .sns, .share, .like, .caption, .credit, .watermark, figcaption, [class*='social'], [class*='sns'], " +
        "[class*='share'], [class*='like'], img"
    );
    elementsToRemove.forEach((element) => element.remove());

    let content = mainClone.textContent.trim();

    content = content
      .replace(/\s\s+/g, " ")
      .replace(/(\.\s)/g, ".\n\n")
      .replace(/GettyImages/gi, "")
      .trim();

    return content;
  }

  return "Main content not found.";
}
