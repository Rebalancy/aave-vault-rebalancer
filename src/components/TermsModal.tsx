'use client';

import React, { useState, useEffect } from 'react';

const TERMS_ACCEPTED_KEY = 'yieldr_terms_accepted';
const TERMS_VERSION = '2025-12-03'; // Update this when terms change

export const TermsModal = () => {
  const [showModal, setShowModal] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Check if user has already accepted current version of terms
    const acceptedVersion = localStorage.getItem(TERMS_ACCEPTED_KEY);
    if (acceptedVersion !== TERMS_VERSION) {
      setShowModal(true);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem(TERMS_ACCEPTED_KEY, TERMS_VERSION);
    setShowModal(false);
  };

  // Don't render on server or if terms already accepted
  if (!mounted || !showModal) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-gray1 border border-gray3 rounded-xl max-w-2xl w-full mx-4 max-h-[85vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="p-6 border-b border-gray3">
          <h2 className="text-xl font-semibold text-white">Terms of Use & Disclaimer</h2>
          <p className="text-sm text-gray5 mt-1">(Educational, Testnet-Only Application)</p>
          <p className="text-xs text-gray5 mt-1">Effective Date: December 3, 2025</p>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 text-sm text-gray-300 space-y-4">
          <section>
            <h3 className="text-white font-medium mb-2">1. Overview</h3>
            <p className="text-gray-400 leading-relaxed">
              The Yieldr Aave Vault Rebalancer (the &quot;Application&quot; or &quot;Site&quot;) is an experimental application and interface deployed exclusively on testnet environments. It interacts only with testnet contracts and testnet assets, which have no monetary value. By accessing or using the Site, you agree to these Terms of Use (&quot;Terms&quot;). Please read these Terms carefully as they are a binding legal agreement between you (&quot;You&quot; or &quot;Your&quot;) and Yonder Labs (&quot;Yonder&quot;, the &quot;Company&quot;, &quot;us&quot;, &quot;we&quot;, or &quot;our&quot;) that governs your access to and use of the Site.
            </p>
            <p className="text-gray-400 leading-relaxed mt-2">
              <strong className="text-white">If you do not agree, do not use the Application.</strong>
            </p>
          </section>

          <section>
            <h3 className="text-white font-medium mb-2">2. Components; Testnet-Only; No Real Assets</h3>
            <p className="text-gray-400 leading-relaxed">
              The Application is designed for development, experimentation, and demonstration purposes only. It does not support real assets and must not be used to manage or simulate real-value positions. Testnet tokens do not represent actual cryptocurrency and cannot be redeemed or exchanged for real funds.
            </p>
            <p className="text-gray-400 leading-relaxed mt-2">
              By using the Application, you acknowledge that testnet tokens may be permanently lost due to contract behavior, network conditions, bugs, reverts, or resets. The Company has no ability to restore, replace, or compensate for any lost testnet tokens.
            </p>
            <p className="text-gray-400 leading-relaxed mt-2">The Application is an educational demo that combines five components:</p>
            <ul className="list-disc list-inside text-gray-400 mt-2 space-y-1 ml-2">
              <li><strong className="text-gray-300">EVM Contract:</strong> the user-facing vault for depositing and withdrawing funds;</li>
              <li><strong className="text-gray-300">NEAR Contract:</strong> guardrails the agent and controls the accounts used for AAVE interactions;</li>
              <li><strong className="text-gray-300">Oracle:</strong> A custom oracle that reconciles balances across all agent accounts across chains;</li>
              <li><strong className="text-gray-300">Agent:</strong> A TEE-based autonomous agent that manages the vault and executes rebalancing strategies;</li>
              <li><strong className="text-gray-300">Frontend:</strong> The interface for users to interact with the protocol.</li>
            </ul>
          </section>

          <section>
            <h3 className="text-white font-medium mb-2">3. No Warranty; Experimental Software</h3>
            <p className="text-gray-400 leading-relaxed">
              You understand and agree that the Application is experimental, may contain bugs, may produce inaccurate outputs, and may be modified or discontinued at any time.
            </p>
            <p className="text-gray-400 leading-relaxed mt-2">
              The Application is provided &quot;AS IS&quot; and &quot;AS AVAILABLE&quot;, without warranties of any kind, whether express or implied, including any warranty of performance, merchantability, fitness for a particular purpose, accuracy, reliability, or non-infringement. By using this demo, you accept all risks.
            </p>
          </section>

          <section>
            <h3 className="text-white font-medium mb-2">4. No Fiduciary Duty; No Advice</h3>
            <p className="text-gray-400 leading-relaxed">Nothing in the Site constitutes:</p>
            <ul className="list-disc list-inside text-gray-400 mt-2 space-y-1 ml-2">
              <li>investment advice;</li>
              <li>financial, legal, or tax advice;</li>
              <li>a recommendation to take or refrain from any action</li>
            </ul>
            <p className="text-gray-400 leading-relaxed mt-2">
              You are solely responsible for evaluating any information generated by the Site. The operators of the Application owe no fiduciary duties to users.
            </p>
          </section>

          <section>
            <h3 className="text-white font-medium mb-2">5. Limitation of Liability</h3>
            <p className="text-gray-400 leading-relaxed">To the maximum extent permitted by applicable law:</p>
            <ul className="list-disc list-inside text-gray-400 mt-2 space-y-1 ml-2">
              <li>The operators, contributors, and developers of the Application are not liable for any damages arising from or related to your use of, or inability to use, the Application, including but not limited to loss of data, delays, downtime, corruption, inaccurate output, or decisions made in reliance on the Application.</li>
              <li>All liability is disclaimed, whether based in contract, tort, negligence, strict liability, or otherwise.</li>
            </ul>
          </section>

          <section>
            <h3 className="text-white font-medium mb-2">6. Acceptable Use</h3>
            <p className="text-gray-400 leading-relaxed">You may not:</p>
            <ul className="list-disc list-inside text-gray-400 mt-2 space-y-1 ml-2">
              <li>attempt to use the Application with mainnet assets or real-value systems;</li>
              <li>attempt to bypass security, break, overload, or interfere with the Application;</li>
              <li>misrepresent the nature or output of the Application;</li>
              <li>use the Application in violation of applicable laws or regulations</li>
            </ul>
            <p className="text-gray-400 leading-relaxed mt-2">
              You agree to use the Application for lawful, testnet-appropriate purposes only.
            </p>
          </section>

          <section>
            <h3 className="text-white font-medium mb-2">7. Intellectual Property</h3>
            <p className="text-gray-400 leading-relaxed">
              The codebase is open-source and your rights to use, modify, or distribute the code are governed solely by the applicable open-source license, which is incorporated by reference. Nothing here grants you IP rights beyond that license.
            </p>
          </section>

          <section>
            <h3 className="text-white font-medium mb-2">8. Privacy</h3>
            <p className="text-gray-400 leading-relaxed">
              The Application may automatically log non-personal information such as requests, browser metadata, testnet addresses, or usage patterns for debugging, security, and performance purposes. No user-provided personal information is required to use the Application. If you provide any information voluntarily, you do so at your own discretion.
            </p>
          </section>

          <section>
            <h3 className="text-white font-medium mb-2">9. Modifications; Termination</h3>
            <p className="text-gray-400 leading-relaxed">
              The Site may be updated, modified, or discontinued at any time without notice. These Terms may also be updated occasionally; continued use after an update constitutes acceptance of the new Terms.
            </p>
          </section>

          <section>
            <h3 className="text-white font-medium mb-2">10. Governing Law</h3>
            <p className="text-gray-400 leading-relaxed">
              These Terms shall be governed by, and construed in accordance with, the laws of the Cayman Islands, excluding choice of law provisions. Any dispute arising from these Terms or your use of the Application must be brought in the courts of the Cayman Islands. By using this demo, you agree to bring claims only on an individual basis and not as part of any class, consolidated, or representative action.
            </p>
          </section>

          <section>
            <h3 className="text-white font-medium mb-2">11. Contact</h3>
            <p className="text-gray-400 leading-relaxed">
              For questions or bug reports, please contact: <a href="mailto:info@yonderlabs.xyz" className="text-blue-400 hover:text-blue-300">info@yonderlabs.xyz</a>
            </p>
          </section>
        </div>

        {/* Footer with Accept Button */}
        <div className="p-6 border-t border-gray3 bg-gray1">
          <button
            onClick={handleAccept}
            className="w-full bg-white text-black font-medium py-3 px-6 rounded-lg hover:bg-gray-200 transition-colors"
          >
            I Agree to the Terms of Use
          </button>
        </div>
      </div>
    </div>
  );
};

export default TermsModal;

