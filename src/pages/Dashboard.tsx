import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import Layout from '@/components/Layout';

const Dashboard = () => {
  const { t } = useLanguage();

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold mb-6">{t('nav.dashboard')}</h1>
        <p className="text-xl mb-4">{t('dashboard.signals.realtime')}</p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
          <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-800/50 flex flex-col h-full">
            <h3 className="text-lg font-medium mb-2">{t('dashboard.stats.totalSignals')}</h3>
            <p className="text-2xl font-bold">254</p>
          </div>
          
          <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-800/50 flex flex-col h-full">
            <h3 className="text-lg font-medium mb-2">{t('dashboard.stats.successRate')}</h3>
            <p className="text-2xl font-bold">87%</p>
          </div>
          
          <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-800/50 flex flex-col h-full">
            <h3 className="text-lg font-medium mb-2">{t('dashboard.stats.totalProfit')}</h3>
            <p className="text-2xl font-bold">R$ 12.450</p>
          </div>
          
          <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-800/50 flex flex-col h-full">
            <h3 className="text-lg font-medium mb-2">{t('dashboard.stats.todayOperations')}</h3>
            <p className="text-2xl font-bold">12</p>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Dashboard; 