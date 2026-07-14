import React from 'react';
import { useTranslation } from 'react-i18next';
import { Calendar, X } from 'lucide-react';

interface ScheduleModalProps {
  adId: string | null;
  onClose: () => void;
}

export function ScheduleModal({ adId, onClose }: ScheduleModalProps) {
  const { t } = useTranslation();
  if (adId === null) return null;

  const handleSaveSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#333] bg-opacity-50">
      <div className="bg-white rounded-sm shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="px-5 py-3 border-b border-[#e5e5e5] flex justify-between items-center">
          <h3 className="text-[16px] font-semibold text-[#333] flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#7C3AED]" /> {t('scheduleModal.title')}
          </h3>
          <button onClick={onClose} className="text-[#666] hover:text-[#333]">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSaveSchedule} className="p-5 space-y-4">
          <div>
            <label className="block text-[13px] font-semibold text-[#333] mb-1">{t('scheduleModal.interval')}</label>
            <select className="w-full border border-[#ccc] rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:border-[#7C3AED]">
              <option>{t('scheduleModal.daily')}</option>
              <option>{t('scheduleModal.every3days')}</option>
              <option>{t('scheduleModal.weekly')}</option>
            </select>
          </div>
          <div>
            <label className="block text-[13px] font-semibold text-[#333] mb-1">{t('scheduleModal.when')}</label>
            <input
              type="time"
              defaultValue="18:00"
              className="w-full border border-[#ccc] rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:border-[#7C3AED]"
            />
          </div>
          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-[13px] font-medium text-[#333] bg-[#f2f2f2] border border-[#ccc] hover:bg-[#e6e6e6] rounded-sm transition-colors"
            >
              {t('scheduleModal.cancel')}
            </button>
            <button
              type="submit"
              className="px-3 py-1.5 text-[13px] font-medium text-white bg-[#7C3AED] hover:bg-purple-700 rounded-sm transition-colors"
            >
              {t('scheduleModal.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
