from fastapi import FastAPI
from pydantic import BaseModel
from transformers import PegasusTokenizer, PegasusForConditionalGeneration, AutoTokenizer, AutoModelForSeq2SeqLM
import uvicorn
import re

app = FastAPI()

# 요청 데이터 모델 정의
class TextData(BaseModel):
    text: str

# 요약 모델 및 토크나이저 설정
summarizer_model_name = "EXP442/pegasus_summarizer"
summarizer_tokenizer = PegasusTokenizer.from_pretrained(summarizer_model_name)
summarizer_model = PegasusForConditionalGeneration.from_pretrained(summarizer_model_name)

# 번역 모델 및 토크나이저 설정
translator_model_name = "EXP442/nllb_translator_pretrained"
translator_model = AutoModelForSeq2SeqLM.from_pretrained(translator_model_name, forced_bos_token_id=256098)
translator_tokenizer = AutoTokenizer.from_pretrained(translator_model_name, src_lang='eng_Latn', tgt_lang='kor_Hang')

# 텍스트 번역 함수
def translate_text(text):
    inputs = translator_tokenizer(text, return_tensors="pt", truncation=True)
    translated_ids = translator_model.generate(inputs["input_ids"], max_length=512, num_beams=4, early_stopping=True)
    translation = translator_tokenizer.decode(translated_ids[0], skip_special_tokens=True)
    return translation

# 텍스트 분할 함수
def split_text_with_last_sentence_overlap(text, target_chunk_length=2048):
    sentences = re.split(r'(?<=[.!?]) +', text)
    chunks = []
    current_chunk = ""

    for sentence in sentences:
        if len(current_chunk) + len(sentence) <= target_chunk_length:
            current_chunk += sentence + " "
        else:
            chunks.append(current_chunk.strip())
            current_chunk = chunks[-1].split()[-1] + " " + sentence + " "

    if current_chunk:
        chunks.append(current_chunk.strip())

    return chunks 

# 긴 텍스트 요약 함수
def summarize_long_text(article_text, target_chunk_length=2048):
    chunks = split_text_with_last_sentence_overlap(article_text, target_chunk_length)
    summaries = []

    for chunk in chunks:
        inputs = summarizer_tokenizer(chunk, max_length=target_chunk_length, return_tensors="pt", truncation=True)
        summary_ids = summarizer_model.generate(inputs["input_ids"], max_length=100, min_length=50, length_penalty=2.0, num_beams=2, early_stopping=True)
        summary = summarizer_tokenizer.decode(summary_ids[0], skip_special_tokens=True)
        summaries.append(summary)

    return summaries 

# 요약과 번역을 결합하는 함수
def translate_and_combine_summaries(summaries):
    translated_summaries = [translate_text(summary) for summary in summaries]
    combined_translation = "\n".join(translated_summaries)
    return combined_translation 

# 엔드포인트 정의
@app.post("/process_text")
async def process_text(data: TextData):
    article_text = data.text
    
    # 텍스트 요약
    summaries = summarize_long_text(article_text)
    
    # 요약된 텍스트를 번역
    combined_translation = translate_and_combine_summaries(summaries)
    
    # 결과 반환
    return {"summary_translation": combined_translation}

# FastAPI 서버 실행
if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
