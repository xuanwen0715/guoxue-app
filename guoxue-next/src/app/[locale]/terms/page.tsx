import { useTranslations, useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';

export default function TermsPage() {
  const locale = useLocale();
  const isZh = locale === 'zh';

  return (
    <div className="legal-page">
      <div className="legal-container">
        <Link href="/" className="legal-back">
          ← {isZh ? '返回首页' : 'Back to Home'}
        </Link>

        <article className="legal-content">
          <h1>{isZh ? '服务条款' : 'Terms & Conditions'}</h1>
          <p className="legal-date">
            {isZh ? '最后更新日期' : 'Last Updated'}: 2025-12-09
          </p>

          <section>
            <h2>{isZh ? '1. 使用资格' : '1. Eligibility'}</h2>
            <p>
              {isZh
                ? '您必须在所在司法区域具备合法使用在线服务的资格。通过使用本网站，您确认您已年满18周岁或在父母/监护人的监督下使用本服务。'
                : 'You must have the legal capacity to use online services in your jurisdiction. By using this website, you confirm that you are at least 18 years old or are using this service under parental/guardian supervision.'}
            </p>
          </section>

          <section>
            <h2>{isZh ? '2. 服务内容' : '2. Service Description'}</h2>
            <p>
              {isZh
                ? '本网站（"国学宝典"）提供古文翻译、字典查询、OCR识别等在线工具服务。服务内容可能随时更新或调整，恕不另行通知。'
                : 'This website ("GuoXue Dictionary") provides online tools including classical Chinese translation, dictionary lookup, OCR recognition, and related services. Content may be updated or adjusted at any time without prior notice.'}
            </p>
          </section>

          <section>
            <h2>{isZh ? '3. 账户与订阅' : '3. Account & Subscription'}</h2>
            <p>
              {isZh
                ? <>
                    <strong>账户注册：</strong>您需要提供有效的电子邮件地址注册账户。您有责任维护账户安全并对所有账户活动负责。
                    <br /><br />
                    <strong>订阅服务：</strong>我们提供月度和年度订阅计划。订阅费用将通过您选择的支付方式自动扣除，直到您取消订阅为止。
                    <br /><br />
                    <strong>取消订阅：</strong>您可以随时取消订阅。取消后，您将继续享有服务直到当前计费周期结束。
                  </>
                : <>
                    <strong>Account Registration:</strong> You need to provide a valid email address to register an account. You are responsible for maintaining account security and all account activities.
                    <br /><br />
                    <strong>Subscription Service:</strong> We offer monthly and yearly subscription plans. Subscription fees will be automatically charged through your chosen payment method until you cancel.
                    <br /><br />
                    <strong>Cancellation:</strong> You may cancel your subscription at any time. After cancellation, you will continue to have access until the end of the current billing period.
                  </>}
            </p>
          </section>

          <section>
            <h2>{isZh ? '4. 支付与退款' : '4. Payment & Refunds'}</h2>
            <p>
              {isZh
                ? <>
                    <strong>支付处理：</strong>所有支付通过第三方支付服务商 Paddle 处理。我们不直接存储您的支付卡信息。
                    <br /><br />
                    <strong>退款政策：</strong>如果您对服务不满意，可在首次订阅后7天内申请全额退款。超过7天后，我们不提供退款，但您可以取消续订。
                    <br /><br />
                    <strong>价格变更：</strong>我们保留随时调整订阅价格的权利。价格变更将在下一个计费周期生效，并会提前通知您。
                  </>
                : <>
                    <strong>Payment Processing:</strong> All payments are processed through our third-party payment provider, Paddle. We do not directly store your payment card information.
                    <br /><br />
                    <strong>Refund Policy:</strong> If you are not satisfied with the service, you may request a full refund within 7 days of your first subscription. After 7 days, we do not provide refunds, but you may cancel your subscription.
                    <br /><br />
                    <strong>Price Changes:</strong> We reserve the right to adjust subscription prices at any time. Price changes will take effect in the next billing cycle, and you will be notified in advance.
                  </>}
            </p>
          </section>

          <section>
            <h2>{isZh ? '5. 用户行为' : '5. User Conduct'}</h2>
            <p>
              {isZh
                ? '您同意不从事以下行为：违反任何适用法律法规；干扰、攻击或未经授权访问本网站；将本网站用于欺诈、滥用或非法用途；尝试逆向工程或破解本服务；大量自动化请求或滥用API。'
                : 'You agree not to: violate any applicable laws; interfere with, attack, or gain unauthorized access to the website; use the service for fraud, abuse, or illegal purposes; attempt to reverse engineer or crack the service; make excessive automated requests or abuse APIs.'}
            </p>
          </section>

          <section>
            <h2>{isZh ? '6. 知识产权' : '6. Intellectual Property'}</h2>
            <p>
              {isZh
                ? '本网站的内容、设计、商标和技术受知识产权法保护。未经书面授权，不得复制、修改、分发或商业使用本网站内容。用户生成的翻译结果仅供个人使用。'
                : 'The content, design, trademarks, and technology of this website are protected by intellectual property laws. Without written authorization, you may not copy, modify, distribute, or commercially use the website content. User-generated translation results are for personal use only.'}
            </p>
          </section>

          <section>
            <h2>{isZh ? '7. 免责声明' : '7. Disclaimer'}</h2>
            <p>
              {isZh
                ? '本服务按"现状"提供，不保证信息的准确性、完整性或可靠性。翻译和字典结果仅供参考，不应作为学术或法律依据。对于因使用本服务产生的任何损失，我们不承担责任。'
                : 'The service is provided "as is" without guarantees regarding accuracy, completeness, or reliability. Translation and dictionary results are for reference only and should not be used as academic or legal basis. We are not liable for any losses arising from the use of this service.'}
            </p>
          </section>

          <section>
            <h2>{isZh ? '8. 责任限制' : '8. Limitation of Liability'}</h2>
            <p>
              {isZh
                ? '在法律允许的最大范围内，本网站对因使用或无法使用本服务引起的任何直接、间接、附带、特殊或后果性损害不承担责任，包括但不限于利润损失、数据丢失或业务中断。'
                : 'To the maximum extent permitted by law, this website shall not be liable for any direct, indirect, incidental, special, or consequential damages arising from the use or inability to use this service, including but not limited to loss of profits, data loss, or business interruption.'}
            </p>
          </section>

          <section>
            <h2>{isZh ? '9. 第三方服务' : '9. Third-Party Services'}</h2>
            <p>
              {isZh
                ? '本网站可能包含第三方链接或集成第三方服务（如支付处理、分析工具）。我们对这些第三方服务的内容或行为不承担责任，建议您查阅其各自的服务条款。'
                : 'This website may contain links to or integrate with third-party services (such as payment processing, analytics tools). We are not responsible for the content or conduct of these third-party services, and we recommend reviewing their respective terms of service.'}
            </p>
          </section>

          <section>
            <h2>{isZh ? '10. 条款变更' : '10. Changes to Terms'}</h2>
            <p>
              {isZh
                ? '我们保留随时更新本服务条款的权利。重大变更将通过网站公告或电子邮件通知用户。继续使用本服务即表示您接受更新后的条款。'
                : 'We reserve the right to update these terms at any time. Significant changes will be notified to users through website announcements or email. Continued use of the service constitutes acceptance of the updated terms.'}
            </p>
          </section>

          <section>
            <h2>{isZh ? '11. 联系我们' : '11. Contact Us'}</h2>
            <p>
              {isZh
                ? '如有任何问题或疑虑，请通过以下方式联系我们：'
                : 'If you have any questions or concerns, please contact us at:'}
            </p>
            <p className="legal-contact">
              Email: gongxuanwen678@gmail.com
            </p>
          </section>
        </article>

        <div className="legal-footer">
          <Link href="/privacy" className="legal-link">
            {isZh ? '隐私政策' : 'Privacy Policy'}
          </Link>
        </div>
      </div>
    </div>
  );
}
