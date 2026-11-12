import { LegalDoc, Section } from "@/components/LegalDoc";

export const metadata = { title: "AI 답변 안내 · 온기노트" };

export default function AiNoticePage() {
  return (
    <LegalDoc
      title="AI 답변 안내"
      intro={
        <p className="rounded-2xl bg-white p-4 text-ink">
          온기노트의 캐릭터(몽글, 여울, 올리, 다온)는 <b>사람이 아닌 AI</b>예요. 모든 답변과 정리 카드는 AI가 만들어요.
        </p>
      }
    >
      <Section title="어떤 AI를 쓰나요">
        <p>
          Anthropic의 Claude 모델로 답변을 만들어요. 캐릭터마다 성격과 말투를 정해 두었지만, 같은 질문에도 매번 조금씩 다르게 답할 수 있어요. 최신 정보가
          필요하면 웹 검색 결과를 참고하기도 해요.
        </p>
      </Section>

      <Section title="AI 답변의 한계">
        <ul>
          <li>AI는 틀린 말을 사실처럼 할 수 있어요. 중요한 결정은 꼭 스스로 한 번 더 생각해 주세요.</li>
          <li>AI는 내가 들려준 이야기만 알아요. 상대방의 진짜 마음을 알 수는 없어요. 답변은 가능성 중 하나로 받아들여 주세요.</li>
          <li>캐릭터는 전문 심리상담사, 의사, 변호사가 아니에요. 진단하거나 치료하지 않아요.</li>
          <li>캡처 사진 속 글자가 작거나 흐리면 잘못 읽을 수 있어요.</li>
        </ul>
      </Section>

      <Section title="표시하는 곳">
        <ul>
          <li>상담 화면 맨 위에 캐릭터가 AI라는 안내를 보여줘요.</li>
          <li>정리 카드와 내려받은 기록(PDF)에는 &lsquo;AI가 정리한 내용&rsquo;이라고 표시해요.</li>
        </ul>
      </Section>

      <Section title="힘든 순간에는 사람에게 연락해 주세요">
        <p>스스로를 해치고 싶은 마음이 들거나, 누군가에게 위협을 받고 있다면 AI 말고 지금 바로 전문가와 이야기해 주세요. 모두 24시간 받아요.</p>
        <ul>
          <li><b>자살예방상담전화</b> 109</li>
          <li><b>정신건강위기상담</b> 1577-0199</li>
          <li><b>여성긴급전화</b> 1366 (교제폭력, 스토킹, 성폭력)</li>
          <li><b>위급할 때</b> 112(경찰), 119(구급)</li>
        </ul>
      </Section>

      <Section title="내 이야기는 어떻게 다뤄지나요">
        <p>
          답변을 만들기 위해 대화 내용이 미국의 Anthropic으로 전송되고, Anthropic은 30일 안에 이를 삭제하며 AI 학습에 쓰지 않아요. 자세한 내용은
          개인정보 처리방침에서 볼 수 있어요.
        </p>
      </Section>
    </LegalDoc>
  );
}
