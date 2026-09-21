'use client';

import React, { useState, useMemo } from 'react';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import {
  Search,
  BookOpen,
  Sparkles,
  Repeat2,
  FileText,
  ShieldCheck,
  Mail,
  ChevronDown,
  ExternalLink,
} from 'lucide-react';

interface HelpItem {
  id: string;
  question: string;
  answer: string;
  category: 'planning' | 'logging' | 'swaps' | 'clinical' | 'support';
}

const HELP_ITEMS: HelpItem[] = [
  {
    id: 'ai-planning',
    category: 'planning',
    question: 'How does KAINARA generate my meal plans?',
    answer:
      'KAINARA calculates your Basal Metabolic Rate (BMR) and Total Daily Energy Expenditure (TDEE) using the Mifflin-St Jeor equation, adjusted for your activity level and target weight goals. Gemini AI then matches your calorie and macronutrient targets against the official Food and Nutrition Research Institute (FNRI) Philippine Food Composition Table to deliver culturally familiar Filipino dishes.',
  },
  {
    id: 'starter-plan',
    category: 'planning',
    question: 'What is a Starter / Bridge Plan?',
    answer:
      'If your preferred grocery shopping day (e.g., Saturday) is a few days away, KAINARA generates an immediate 1 to 3-day starter plan. This allows you to start your dietary regimen immediately without disrupting your weekly grocery schedule.',
  },
  {
    id: 'outside-logging',
    category: 'logging',
    question: 'How do I log meals eaten outside my plan?',
    answer:
      'Click the "Log Outside Food" button on your Dashboard or Meal History. You can enter any Filipino or international dish with its portion size. KAINARA uses AI nutrient estimation and FNRI food matching to calculate calories, protein, carbs, and fat, and updates your daily totals.',
  },
  {
    id: 'contraindications',
    category: 'logging',
    question: 'What are clinical contraindication warnings?',
    answer:
      'When logging outside food, KAINARA evaluates ingredients against your recorded medical conditions and allergies (e.g. Type 2 Diabetes, Hypertension, Kidney Disease, shellfish, nuts). If a potential contraindication is detected, you will see a prominent safety alert.',
  },
  {
    id: 'swap-limits',
    category: 'swaps',
    question: 'How many meal swaps can I make?',
    answer:
      'Meal swaps are unlimited. Each replacement still has to come from the reviewed Meal Library and match the meal slot, your dietary preferences, and your recorded safety profile.',
  },
  {
    id: 'calorie-delta',
    category: 'swaps',
    question: 'Why does a swap show a ±15% calorie delta warning?',
    answer:
      'To prevent nutritional imbalance, KAINARA warns you if a replacement meal has a calorie variance greater than ±15% compared to the original meal slot. This helps you maintain consistent daily energy intake.',
  },
  {
    id: 'rnd-review',
    category: 'clinical',
    question: 'Who reviews the meal plans and recipes?',
    answer:
      'PRC-licensed Filipino Registered Nutritionist-Dietitians (RNDs) review flagged plans and curate verified recipes in our Meal Library. Items marked with the "Verified RND" badge have undergone clinical inspection.',
  },
  {
    id: 'disclaimer',
    category: 'clinical',
    question: 'Is KAINARA a substitute for medical advice?',
    answer:
      'No. KAINARA provides nutritional planning and dietary tracking. It is not a replacement for clinical medical diagnosis, prescribed medical nutrition therapy, or emergency medical treatment. Always consult your primary physician for critical health conditions.',
  },
  {
    id: 'contact-support',
    category: 'support',
    question: 'How can I contact KAINARA support?',
    answer:
      'You can reach our team at support@kainara.ph for technical questions, account assistance, or feedback. We typically respond within 24 to 48 business hours.',
  },
];

const CATEGORIES = [
  { id: 'all', label: 'All Topics', icon: BookOpen },
  { id: 'planning', label: 'Meal Planning', icon: Sparkles },
  { id: 'logging', label: 'Food Logging', icon: FileText },
  { id: 'swaps', label: 'Meal Swaps', icon: Repeat2 },
  { id: 'clinical', label: 'Safety & RNDs', icon: ShieldCheck },
  { id: 'support', label: 'Contact', icon: Mail },
] as const;

interface HelpCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpCenterModal: React.FC<HelpCenterModalProps> = ({ isOpen, onClose }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>('ai-planning');

  const filteredItems = useMemo(() => {
    return HELP_ITEMS.filter((item) => {
      const matchesCategory = activeCategory === 'all' || item.category === activeCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchesQuery = !q || item.question.toLowerCase().includes(q) || item.answer.toLowerCase().includes(q);
      return matchesCategory && matchesQuery;
    });
  }, [searchQuery, activeCategory]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="KAINARA Help Center"
      description="Quick answers on AI nutrition, FNRI food composition, meal tracking, and clinical safety."
      size="lg"
    >
      <div className="space-y-4 pt-1">
        {/* Search input */}
        <div className="relative">
          <Input
            id="help-search-input"
            name="helpSearch"
            type="text"
            placeholder="Search questions, meal swaps, outside logging..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 text-xs sm:text-sm"
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-brand-muted pointer-events-none" />
        </div>

        {/* Category Pills */}
        <div className="flex flex-wrap gap-1.5 overflow-x-auto pb-1">
          {CATEGORIES.map(({ id, label, icon: Icon }) => {
            const active = activeCategory === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setActiveCategory(id)}
                className={`inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                  active
                    ? 'bg-brand-accent text-[#07100d] shadow-sm'
                    : 'border border-brand-border bg-brand-surface text-brand-muted hover:bg-brand-bgAlt hover:text-brand-text'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{label}</span>
              </button>
            );
          })}
        </div>

        {/* FAQ List */}
        <div className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
          {filteredItems.length === 0 ? (
            <div className="py-8 text-center text-xs text-brand-muted">
              No matching help topics found. Try searching for &ldquo;swap&rdquo;, &ldquo;logging&rdquo;, or
              &ldquo;FNRI&rdquo;.
            </div>
          ) : (
            filteredItems.map((item) => {
              const isExpanded = expandedId === item.id;
              return (
                <div
                  key={item.id}
                  className="rounded-2xl border border-brand-border bg-brand-surface/60 transition-colors hover:border-brand-border/90"
                >
                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : item.id)}
                    className="flex w-full items-center justify-between gap-3 p-3.5 text-left text-xs sm:text-sm font-bold text-brand-text"
                  >
                    <span>{item.question}</span>
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-brand-muted transition-transform duration-200 ${
                        isExpanded ? 'rotate-180 text-brand-green' : ''
                      }`}
                    />
                  </button>
                  {isExpanded && (
                    <div className="border-t border-brand-border/60 px-3.5 pb-3.5 pt-2.5 text-xs leading-relaxed text-brand-muted">
                      {item.answer}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Support Footer Banner */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-2xl border border-brand-border/80 bg-brand-bgAlt/60 p-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand-green/10 text-brand-green">
              <Mail className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-brand-text">Still need assistance?</p>
              <p className="text-[11px] text-brand-muted">Our support and clinical team is here to help.</p>
            </div>
          </div>
          <a
            href="mailto:support@kainara.ph"
            className="inline-flex items-center gap-1.5 rounded-xl border border-brand-border bg-brand-surface px-3 py-1.5 text-xs font-bold text-brand-text hover:bg-brand-bgAlt hover:text-brand-green transition-colors"
          >
            <span>support@kainara.ph</span>
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>
    </Modal>
  );
};

export default HelpCenterModal;
