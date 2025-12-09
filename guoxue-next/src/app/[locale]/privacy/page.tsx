import { useTranslations, useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';

export default function PrivacyPage() {
  const locale = useLocale();
  const isZh = locale === 'zh';

  return (
    <div className="legal-page">
      <div className="legal-container">
        <Link href="/" className="legal-back">
          ← {isZh ? '返回首页' : 'Back to Home'}
        </Link>

        <article className="legal-content">
          <h1>{isZh ? '隐私政策' : 'Privacy Policy'}</h1>
          <p className="legal-date">
            {isZh ? '最后更新日期' : 'Last Updated'}: 2025-12-09
          </p>

          <p className="legal-intro">
            {isZh
              ? '我们重视您的隐私。本隐私政策说明了我们如何收集、使用和保护您在使用"国学宝典"服务时的个人信息。'
              : 'We value your privacy. This Privacy Policy explains how we collect, use, and protect your personal information when you use the "GuoXue Dictionary" service.'}
          </p>

          <section>
            <h2>{isZh ? '1. 我们收集的信息' : '1. Information We Collect'}</h2>
            <p>
              {isZh
                ? <>
                    <strong>账户信息：</strong>当您注册账户时，我们收集您的电子邮件地址和可选的用户名。
                    <br /><br />
                    <strong>支付信息：</strong>支付处理由第三方服务商 Paddle 完成。我们不直接存储您的信用卡或银行卡信息，但会保存订阅状态和交易记录。
                    <br /><br />
                    <strong>使用数据：</strong>我们收集您使用服务的信息，包括查询内容、访问时间、设备类型和浏览器信息。
                    <br /><br />
                    <strong>自动收集的数据：</strong>通过 Cookies 和类似技术，我们可能收集 IP 地址、设备标识符和浏览行为数据。
                  </>
                : <>
                    <strong>Account Information:</strong> When you register an account, we collect your email address and optional username.
                    <br /><br />
                    <strong>Payment Information:</strong> Payment processing is handled by our third-party provider, Paddle. We do not directly store your credit card or bank card information, but we do retain subscription status and transaction records.
                    <br /><br />
                    <strong>Usage Data:</strong> We collect information about how you use the service, including queries, access times, device types, and browser information.
                    <br /><br />
                    <strong>Automatically Collected Data:</strong> Through cookies and similar technologies, we may collect IP addresses, device identifiers, and browsing behavior data.
                  </>}
            </p>
          </section>

          <section>
            <h2>{isZh ? '2. 信息使用方式' : '2. How We Use Information'}</h2>
            <p>
              {isZh
                ? '我们使用收集的信息用于：提供和维护服务；处理您的订阅和支付；改进和个性化用户体验；发送服务相关通知（如订阅续费提醒）；分析服务使用情况以改进功能；防止欺诈和保障安全；遵守法律义务。'
                : 'We use the collected information to: provide and maintain the service; process your subscriptions and payments; improve and personalize user experience; send service-related notifications (such as subscription renewal reminders); analyze service usage to improve features; prevent fraud and ensure security; comply with legal obligations.'}
            </p>
          </section>

          <section>
            <h2>{isZh ? '3. 信息共享' : '3. Information Sharing'}</h2>
            <p>
              {isZh
                ? <>
                    我们不会出售或出租您的个人信息。仅在以下情况下共享信息：
                    <br /><br />
                    <strong>服务提供商：</strong>与帮助我们运营服务的第三方共享（如支付处理商 Paddle、云服务提供商）。
                    <br /><br />
                    <strong>法律要求：</strong>当法律要求或为保护我们的权利时。
                    <br /><br />
                    <strong>业务转让：</strong>在合并、收购或资产出售的情况下。
                  </>
                : <>
                    We do not sell or rent your personal information. We only share information in the following circumstances:
                    <br /><br />
                    <strong>Service Providers:</strong> Shared with third parties that help us operate the service (such as payment processor Paddle, cloud service providers).
                    <br /><br />
                    <strong>Legal Requirements:</strong> When required by law or to protect our rights.
                    <br /><br />
                    <strong>Business Transfers:</strong> In the event of a merger, acquisition, or sale of assets.
                  </>}
            </p>
          </section>

          <section>
            <h2>{isZh ? '4. Cookies 和追踪技术' : '4. Cookies and Tracking'}</h2>
            <p>
              {isZh
                ? '我们使用 Cookies 来：保持您的登录状态；记住您的偏好设置；分析网站流量和使用模式；改进服务质量。您可以通过浏览器设置管理 Cookies，但禁用某些 Cookies 可能影响服务功能。'
                : 'We use cookies to: maintain your login status; remember your preferences; analyze website traffic and usage patterns; improve service quality. You can manage cookies through your browser settings, but disabling certain cookies may affect service functionality.'}
            </p>
          </section>

          <section>
            <h2>{isZh ? '5. 数据安全' : '5. Data Security'}</h2>
            <p>
              {isZh
                ? '我们采取合理的技术和组织措施保护您的个人信息，包括：使用 HTTPS 加密传输；安全存储敏感数据；定期安全审查和更新。然而，没有任何互联网传输或电子存储方法是完全安全的，我们无法保证绝对安全。'
                : 'We take reasonable technical and organizational measures to protect your personal information, including: HTTPS encrypted transmission; secure storage of sensitive data; regular security reviews and updates. However, no method of internet transmission or electronic storage is completely secure, and we cannot guarantee absolute security.'}
            </p>
          </section>

          <section>
            <h2>{isZh ? '6. 数据保留' : '6. Data Retention'}</h2>
            <p>
              {isZh
                ? '我们在需要的时间内保留您的个人信息以提供服务和履行法律义务。当您删除账户后，我们将在合理时间内删除或匿名化您的数据，但可能保留某些信息以遵守法律要求。'
                : 'We retain your personal information for as long as necessary to provide services and fulfill legal obligations. After you delete your account, we will delete or anonymize your data within a reasonable time, but may retain certain information to comply with legal requirements.'}
            </p>
          </section>

          <section>
            <h2>{isZh ? '7. 您的权利' : '7. Your Rights'}</h2>
            <p>
              {isZh
                ? '根据适用法律，您可能拥有以下权利：访问您的个人信息；更正不准确的信息；删除您的账户和数据；反对或限制某些数据处理；数据可携带性。如需行使这些权利，请通过下方联系方式与我们联系。'
                : 'Depending on applicable law, you may have the following rights: access your personal information; correct inaccurate information; delete your account and data; object to or restrict certain data processing; data portability. To exercise these rights, please contact us using the information below.'}
            </p>
          </section>

          <section>
            <h2>{isZh ? '8. 第三方服务' : '8. Third-Party Services'}</h2>
            <p>
              {isZh
                ? <>
                    本服务集成或链接到以下第三方服务，它们有各自的隐私政策：
                    <br /><br />
                    • <strong>Paddle</strong> - 支付处理 (paddle.com)
                    <br />
                    • <strong>Supabase</strong> - 用户认证和数据存储
                    <br />
                    • <strong>Vercel</strong> - 网站托管
                    <br /><br />
                    我们建议您查阅这些服务的隐私政策。
                  </>
                : <>
                    This service integrates with or links to the following third-party services, which have their own privacy policies:
                    <br /><br />
                    • <strong>Paddle</strong> - Payment processing (paddle.com)
                    <br />
                    • <strong>Supabase</strong> - User authentication and data storage
                    <br />
                    • <strong>Vercel</strong> - Website hosting
                    <br /><br />
                    We recommend reviewing the privacy policies of these services.
                  </>}
            </p>
          </section>

          <section>
            <h2>{isZh ? '9. 儿童隐私' : '9. Children\'s Privacy'}</h2>
            <p>
              {isZh
                ? '本服务不面向13岁以下儿童。我们不会故意收集13岁以下儿童的个人信息。如果您发现我们可能收集了儿童信息，请立即联系我们。'
                : 'This service is not intended for children under 13. We do not knowingly collect personal information from children under 13. If you become aware that we may have collected information from a child, please contact us immediately.'}
            </p>
          </section>

          <section>
            <h2>{isZh ? '10. 国际数据传输' : '10. International Data Transfers'}</h2>
            <p>
              {isZh
                ? '您的信息可能被传输到并存储在您所在国家/地区以外的服务器上。我们会采取适当措施确保您的数据受到保护。'
                : 'Your information may be transferred to and stored on servers outside your country/region. We take appropriate measures to ensure your data is protected.'}
            </p>
          </section>

          <section>
            <h2>{isZh ? '11. 隐私政策更新' : '11. Policy Updates'}</h2>
            <p>
              {isZh
                ? '我们可能会不时更新本隐私政策。重大变更将通过网站公告或电子邮件通知您。继续使用服务即表示您接受更新后的政策。'
                : 'We may update this Privacy Policy from time to time. Significant changes will be notified through website announcements or email. Continued use of the service constitutes acceptance of the updated policy.'}
            </p>
          </section>

          <section>
            <h2>{isZh ? '12. 联系我们' : '12. Contact Us'}</h2>
            <p>
              {isZh
                ? '如果您对本隐私政策有任何问题或希望行使您的数据权利，请联系我们：'
                : 'If you have any questions about this Privacy Policy or wish to exercise your data rights, please contact us:'}
            </p>
            <p className="legal-contact">
              Email: gongxuanwen678@gmail.com
            </p>
          </section>
        </article>

        <div className="legal-footer">
          <Link href="/terms" className="legal-link">
            {isZh ? '服务条款' : 'Terms & Conditions'}
          </Link>
        </div>
      </div>
    </div>
  );
}
