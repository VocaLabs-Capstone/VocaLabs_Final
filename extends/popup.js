document.addEventListener("DOMContentLoaded", () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const url = tabs[0].url;

    let detectedSite = "";
    if (url.includes("bbc.com")) {
      detectedSite = "bbc";
    } else if (url.includes("cnn.com")) {
      detectedSite = "cnn";
    } else {
      detectedSite = "other";
    }

    const newsSiteDropdown = document.getElementById("news-site");
    newsSiteDropdown.value = detectedSite;
  });

  // 닫기 버튼 활성화
  const closeButton = document.querySelector(".close-btn");
  if (closeButton) {
    closeButton.addEventListener("click", () => {
      window.close();
    });
  }
});

document.getElementById("crawl-content").addEventListener("click", () => {
  const selectedSite = document.getElementById("news-site").value;

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.scripting.executeScript(
      {
        target: { tabId: tabs[0].id },
        function: getFilteredMainContent,
        args: [selectedSite],
      },
      (results) => {
        const mainContent = results[0].result || "내용이 없습니다.";
        document.getElementById("content-display").value = mainContent;
      }
    );
  });
});

document.getElementById("summarize-content").addEventListener("click", () => {
  let content = document.getElementById("content-display").value;
  if (!content) {
    alert("먼저 콘텐츠를 크롤링하세요.");
    return;
  }

  // 원문 길이 제한 (5000자 초과시 자르기)
  if (content.length > 2000) {
    let truncatedContent = content.slice(0, 2000); // 우선 2000자까지 자름
    const lastSentenceEnd = Math.max(
      truncatedContent.lastIndexOf("."),
      truncatedContent.lastIndexOf("!"),
      truncatedContent.lastIndexOf("?")
    );

    if (lastSentenceEnd !== -1) {
      content = truncatedContent.slice(0, lastSentenceEnd + 1); // 문장 단위로 자름
    } else {
      content = truncatedContent; // 문장 끝을 찾지 못하면 기본적으로 2000자로 자름
    }
  }

  const summaryDisplay = document.getElementById("summary-display");
  summaryDisplay.value = ""; // 결과 초기화
  const loadingSpinner = document.getElementById("loading-spinner");
  loadingSpinner.style.display = "block";

  async function processContent() {
    const requestData = JSON.stringify({ text: content });

    try {
      const response = await fetch("http://34.64.81.1:8080/process_text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: requestData,
      });

      if (!response.ok) {
        summaryDisplay.value = "\n[요약 실패]";
        return;
      }

      const data = await response.json();
      summaryDisplay.value = data.summary_translation || "\n[요약 실패]";
    } catch (error) {
      summaryDisplay.value = "\n[요약에 실패했습니다.]";
    } finally {
      loadingSpinner.style.display = "none";
    }
  }

  processContent();
});

document.getElementById("open-in-new-tab").addEventListener("click", () => {
  const originalContent = document.getElementById("content-display").value;
  const summarizedContent = document.getElementById("summary-display").value;

  if (!originalContent || !summarizedContent) {
    alert("크롤링 및 요약을 먼저 수행하세요.");
    return;
  }

  const newTabContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>원문 및 요약 결과</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.8;
            padding: 20px;
          }
          h2 {
            color: #0099cc;
            font-size: 24px; /* 제목 크기 증가 */
          }
          pre {
            background-color: #f4f4f4;
            padding: 20px;
            border: 1px solid #ddd;
            border-radius: 5px;
            white-space: pre-wrap;
            word-wrap: break-word;
            font-size: 18px; /* 텍스트 크기 증가 */
            line-height: 1.6; /* 텍스트 간격 조정 */
          }
        </style>
      </head>
      <body>
        <h2>크롤링된 원문</h2>
        <pre>${originalContent}</pre>
        <h2>요약 및 번역 결과</h2>
        <pre>${summarizedContent}</pre>
      </body>
    </html>
  `;

  const newTab = window.open();
  newTab.document.open();
  newTab.document.write(newTabContent);
  newTab.document.close();
});

function getFilteredMainContent(selectedSite) {
  let content = "";
  if (selectedSite === "bbc") {
    const textBlocks = document.querySelectorAll(
      'div[data-component="text-block"]'
    );
    textBlocks.forEach((block) => {
      content += block.textContent.trim() + "\n\n";
    });
  } else if (selectedSite === "cnn") {
    const paragraphs = document.querySelectorAll(
      "p.paragraph.inline-placeholder.vossi-paragraph"
    );
    paragraphs.forEach((paragraph) => {
      content += paragraph.textContent.trim() + "\n\n";
    });
  } else {
    alert("지원하지 않는 사이트입니다.");
    return;
  }

  return (
    content
      .replace(/\s\s+/g, " ")
      .replace(/(\.\s)/g, ".\n\n")
      .trim() || "텍스트 블록에 내용이 없습니다."
  );
}
