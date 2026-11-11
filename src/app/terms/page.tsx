import Link from "next/link";
import { LegalDoc, Section } from "@/components/LegalDoc";
import { OPERATOR } from "@/lib/legal";
import { REJOIN_BLOCK_DAYS } from "@/lib/withdrawal";

export const metadata = { title: "이용약관 · 온기노트" };

export default function TermsPage() {
  return (
    <LegalDoc title="이용약관">
      <Section title="제1조 (목적)">
        <p>
          이 약관은 {OPERATOR.name}(이하 &ldquo;운영자&rdquo;)가 제공하는 온기노트 서비스의 이용 조건과 절차, 운영자와 이용자의 권리·의무를 정합니다.
        </p>
      </Section>

      <Section title="제2조 (서비스의 성격)">
        <ol>
          <li>온기노트는 AI 캐릭터와 연애·인간관계 고민을 이야기하고 정리하는 서비스입니다.</li>
          <li>
            캐릭터의 답변은 AI가 만든 것으로, 전문 심리상담·의료·법률 자문을 대신하지 않습니다. 자세한 내용은{" "}
            <Link href="/ai-notice" className="text-accent-text underline">AI 답변 안내</Link>를 따릅니다.
          </li>
          <li>답변 내용을 따를지는 이용자가 스스로 판단하며, 그 결과에 대한 책임은 이용자에게 있습니다.</li>
        </ol>
      </Section>

      <Section title="제3조 (가입)">
        <ol>
          <li>만 14세 이상인 사람만 카카오 또는 구글 계정으로 가입할 수 있습니다.</li>
          <li>가입하려면 이 약관, 개인정보 수집·이용, 민감정보 처리, 개인정보 국외 이전에 동의해야 합니다.</li>
          <li>로그인할 때 이메일 제공에 동의하지 않으면 가입할 수 없습니다.</li>
          <li>탈퇴한 이메일로는 탈퇴일로부터 {REJOIN_BLOCK_DAYS}일 동안 다시 가입할 수 없습니다.</li>
        </ol>
      </Section>

      <Section title="제4조 (이용 한도)">
        <ol>
          <li>
            서비스는 무료로 제공되며, 비용 관리를 위해 1인당 하루 이용량과 서비스 전체의 하루 이용량에 한도가 있습니다. 한도는 매일 한국 시간 자정에 다시
            채워집니다.
          </li>
          <li>한 상담에서 보낼 수 있는 메시지 수에도 한도가 있습니다.</li>
          <li>운영자는 서비스 상황에 따라 한도를 바꿀 수 있으며, 바뀌면 서비스 안에서 알립니다.</li>
        </ol>
      </Section>

      <Section title="제5조 (이용자의 의무)">
        <p>이용자는 다음 행위를 해서는 안 됩니다.</p>
        <ul>
          <li>다른 사람을 몰래 추적·감시·조종하거나 괴롭히는 데 서비스를 쓰는 행위</li>
          <li>다른 사람의 실명, 연락처, 주소 등 그 사람을 특정할 수 있는 정보를 필요 이상으로 입력하는 행위</li>
          <li>불법 촬영물이나 다른 사람의 사생활을 침해하는 사진을 올리는 행위</li>
          <li>서비스를 자동화된 방법으로 대량 이용하거나, 이용 한도를 우회하려는 행위</li>
          <li>다른 사람의 계정을 쓰는 행위</li>
        </ul>
      </Section>

      <Section title="제6조 (이용 제한)">
        <p>
          이용자가 제5조를 어기면 운영자는 사전 안내 후 서비스 이용을 제한하거나 계정을 삭제할 수 있습니다. 다만 다른 사람의 안전이 걱정되는 긴급한 경우에는
          먼저 제한한 뒤 알릴 수 있습니다.
        </p>
      </Section>

      <Section title="제7조 (기록의 관리)">
        <ol>
          <li>상담과 인물 기록은 이용자 본인만 볼 수 있습니다. 운영자는 법령에 따른 경우나 이용자가 요청한 경우가 아니면 기록을 열람하지 않습니다.</li>
          <li>이용자는 마이페이지에서 언제든 기록을 내려받거나 지울 수 있습니다.</li>
          <li>탈퇴하면 모든 기록이 바로 지워지며 되돌릴 수 없습니다.</li>
        </ol>
      </Section>

      <Section title="제8조 (서비스의 변경과 중단)">
        <p>
          운영자는 개인이 운영하는 서비스 특성상 서비스 내용을 바꾸거나 중단할 수 있습니다. 서비스를 종료할 때는 30일 전에 알리고, 그 기간 동안 이용자가
          기록을 내려받을 수 있게 합니다.
        </p>
      </Section>

      <Section title="제9조 (책임의 제한)">
        <ol>
          <li>운영자는 AI 답변의 정확성이나 그 답변을 따른 결과를 보증하지 않습니다.</li>
          <li>운영자는 천재지변, 외부 서비스(AI·로그인·저장소 제공사)의 장애 등 운영자가 통제할 수 없는 사유로 생긴 손해에 책임을 지지 않습니다.</li>
          <li>다만 운영자의 고의 또는 중대한 과실로 생긴 손해는 예외로 합니다.</li>
        </ol>
      </Section>

      <Section title="제10조 (약관의 변경)">
        <p>
          약관을 바꾸면 시행 7일 전부터 서비스 안에서 알립니다. 이용자에게 불리한 변경은 30일 전에 알리고 다시 동의를 받습니다. 동의하지 않으면 탈퇴할 수
          있습니다.
        </p>
      </Section>

      <Section title="제11조 (문의와 분쟁 해결)">
        <p>
          서비스 문의는 <a href={`mailto:${OPERATOR.email}`} className="text-accent-text underline">{OPERATOR.email}</a>로 보내 주세요. 이 약관은
          대한민국 법을 따르며, 분쟁이 생기면 「민사소송법」에 따른 관할 법원에서 해결합니다.
        </p>
      </Section>
    </LegalDoc>
  );
}
