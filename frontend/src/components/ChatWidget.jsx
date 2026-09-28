import React from 'react';
import { MessageCircle } from 'lucide-react';
import { useSiteSettings } from '../context/SiteContext';
import { useLanguage } from '../i18n/LanguageContext';

const ChatWidget = () => {
  const { t } = useLanguage();
  const { site } = useSiteSettings();
  const supportChatUrl = site.support_chat_url;

  if (!supportChatUrl) return null;

  return (
    <a
      href={supportChatUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t('nav.supportChat')}
      className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 h-14 w-14 rounded-full bg-brand-gradient text-white flex items-center justify-center shadow-glow-lg transition-all duration-300 hover:scale-110 active:scale-95"
    >
      <span className="absolute inset-0 rounded-full ring-1 ring-inset ring-white/25" />
      <MessageCircle className="h-6 w-6" />
      <span className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-emerald-400 ring-2 ring-white" />
    </a>
  );
};

export default ChatWidget;
