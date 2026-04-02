import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { userService } from '@/services/userService';
import { geoLocationService } from '@/services/geoLocationService';
import { supabase } from '@/lib/supabase';

export type Language = 'pt' | 'en' | 'es';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
  tObj: <T>(key: string) => T | null;
  changeLanguage: (lang: Language) => void;
  updateUserLanguage: (userId: string, lang: Language) => Promise<void>;
  loadUserLanguageFromDB: (userId: string) => Promise<void>;
  forceLanguageDetection: () => Promise<Language>;
  getLanguageDetectionInfo: () => { source: string | null; country: string | null; language: string | null; cached: boolean; };
  availableLanguages: { code: Language; name: string }[];
}

interface LanguageProviderProps {
  children: ReactNode;
}

// Definição de tipo para as traduções
interface TranslationRecord {
  [key: string]: string | TranslationRecord | {
    [key: string]: string | TranslationRecord;
  };
  
  // Defina as propriedades aninhadas para evitar erros de TypeScript
  live?: {
    title: string;
    subtitle: string;
    active_streams: string;
    active_count: string;
    no_active: string;
    no_streams_message: string;
    live: string;
    comments: string;
    no_comments: string;
    type_comment: string;
    streaming_placeholder: string;
    about: string;
    end_stream: string;
    start_streaming: string;
    start_streaming_desc: string;
    stream_title: string;
    stream_description: string;
    title_placeholder: string;
    description_placeholder: string;
    go_live: string;
    no_permission_title: string;
    no_permission_desc: string;
    error: {
      title_required: string;
      media_access: string;
    };
  };
  
  meetings?: {
    title: string;
    subtitle: string;
    active_meetings: string;
    create_meeting: string;
    meeting_title: string;
    meeting_description: string;
    title_placeholder: string;
    description_placeholder: string;
    start_meeting: string;
    creating_meeting: string;
    no_active_meetings: string;
    participants: string;
    join: string;
    end_meeting: string;
    copy_link: string;
    link_copied: string;
    about: {
      title: string;
      intro: string;
      how_works: string;
      benefits: string;
      features: {
        permission: string;
        google_meet: string;
        join: string;
        share: string;
        screen_sharing: string;
        chat: string;
        quality: string;
        stability: string;
      };
    };
    error: {
      title_required: string;
      permission_denied: string;
      create_failed: string;
      end_failed: string;
    };
    demo: {
      title: string;
      description: string;
      create_hint: string;
      features_title: string;
      feature_1: string;
      feature_2: string;
      feature_3: string;
      feature_4: string;
      feature_5: string;
      coming_soon: string;
      soon_1: string;
      soon_2: string;
      soon_3: string;
      soon_4: string;
    };
  };
  
  support?: {
    title: string;
    subtitle: string;
    welcome: string;
    input_placeholder: string;
    send: string;
    online: string;
    typing: string;
    human_support: string;
    ai_disclaimer: string;
    chat: {
      title: string;
      subtitle: string;
      placeholder: string;
    };
    topics: {
      select_topic: string;
      help_topics: string;
      back_to_topics: string;
      support_trending: string;
    };
    topic_investment: {
      title: string;
      description: string;
      q1: {
        question: string;
        answer: string;
      };
      q2: {
        question: string;
        answer: string;
      };
      q3: {
        question: string;
        answer: string;
      };
    };
    topic_platform: {
      title: string;
      description: string;
      q1: {
        question: string;
        answer: string;
      };
      q2: {
        question: string;
        answer: string;
      };
      q3: {
        question: string;
        answer: string;
      };
      q4: {
        question: string;
        answer: string;
      };
      q5: {
        question: string;
        answer: string;
      };
      q6: {
        question: string;
        answer: string;
      };
    };
    topic_account: {
      title: string;
      description: string;
      q1: {
        question: string;
        answer: string;
      };
      q2: {
        question: string;
        answer: string;
      };
      q3: {
        question: string;
        answer: string;
      };
    };
    topic_feedback: {
      title: string;
      description: string;
      q1: {
        question: string;
        answer: string;
      };
      q2: {
        question: string;
        answer: string;
      };
      q3: {
        question: string;
        answer: string;
      };
      q4: {
        question: string;
        answer: string;
      };
    };
  };
}

// Tipo para valores de tradução
type TranslationValue = string | {
  text: string;
  link?: string;
} | TranslationObject;

// Tipo para objeto de traduções (permite aninhamento)
interface TranslationObject {
  [key: string]: TranslationValue;
}

// Tipo para as traduções por idioma
interface TranslationsType {
  [language: string]: TranslationObject;
}

// Traduções para os três idiomas
const translations: TranslationsType = {
  pt: {
    // Navbar
    'nav.home': 'Início',
    'nav.dashboard': 'Dashboard',
    'nav.settings': 'Configurações',
    'nav.instructions': 'Instruções',
    'nav.signals': 'Trades',
    'nav.signals.title': 'Trades do Mercado',
    'nav.news': 'Notícias',
    'nav.news.title': 'Notícias do Mercado',
    'nav.news.none': 'Nenhuma notícia disponível',
    'nav.notifications': 'Notificações',
    'nav.notifications.read': 'Notificações Lidas',
    'nav.settings.notifications': 'Área do Usuário',
    'nav.system.status': 'Status do sistema',
    'nav.system.online': 'Online',
    'nav.support': 'Suporte',
    'nav.live': 'Ao Vivo',
    'nav.meetings': 'Reuniões',
    'nav.toggle.sidebar': 'Alternar Barra Lateral',
    'nav.admin': 'Administração',
    
    // News
    'news.subtitle': 'Acompanhe as últimas notícias do mercado de criptomoedas e finanças',
    'news.refresh': 'Atualizar',
    'news.updated': 'Atualizado!',
    'news.loading': 'Buscando as últimas notícias do mercado...',
    'news.error.loading': 'Erro ao carregar notícias',
    'news.error.tryAgain': 'Tente novamente mais tarde.',
    'news.tryAgain': 'Tentar novamente',
    'news.none': 'Nenhuma notícia disponível no momento.',
    'news.filter.label': 'Filtrar por:',
    'news.filter.all': 'Todas',
    'news.filter.markets': 'Mercados & Trading',
    'news.filter.economy': 'Economia & Política',
    'news.filter.tech': 'Tecnologia & Inovação',
    'news.filter.commodities': 'Commodities & ESG',
    'news.filter.global': 'Global & Geopolítica',
    'news.filter.noResults': 'Nenhuma notícia encontrada para',
    'news.filter.totalAvailable': 'Total disponível:',
    'news.filter.news': 'notícias',
    'news.filter.viewAll': 'Ver todas',
    
    // Common
    'common.cancel': 'Cancelar',
    'common.saving': 'Salvando...',
    'common.saved': 'Salvo',
    'common.loading': 'Carregando...',
    'common.error': 'Erro',
    'common.success': 'Sucesso',
    'common.summary': 'Resumo',
    
    // Profile
    'profile.name.addHint': 'Adicione um nome para personalizar seu perfil',
    'profile.error.emptyName': 'Por favor, insira um nome de exibição',
    
    // Dashboard
    'dashboard.title': 'Acompanhe o mercado em tempo real',
    'dashboard.market.opportunities': 'Oportunidades de mercado baseadas em análise de dados em tempo real',
    'dashboard.refresh.all': 'Atualizar Todos',
    'dashboard.signals.title': 'Trades em Alta',
    'dashboard.signals.entry': 'Entrada',
    'dashboard.signals.expiration': 'Expiração',
    'dashboard.signals.reentry1': 'Reentrada 1',
    'dashboard.signals.reentry2': 'Reentrada 2',
    'dashboard.signals.updated': 'Atualizado',
    'dashboard.signals.trade': 'Realizar trade',
    'dashboard.signals.loading': 'Carregando sinais...',
    'dashboard.signals.loading_error': 'Falha ao carregar sinais',
    'dashboard.signals.loading_error_desc': 'Não foi possível obter os sinais de trading no momento.',
    'dashboard.signals.view_all': 'Ver todos',
    'dashboard.signals.realtime': 'Sinais em Tempo Real',
    'dashboard.signals.waiting': 'Aguardando novos sinais...',
    'dashboard.stats.totalSignals': 'Total de Sinais',
    'dashboard.stats.successRate': 'Taxa de Acerto',
    'dashboard.stats.monthlyGain': 'Ganho Mensal',
    'dashboard.stats.monthlyLoss': 'Perda Mensal',
    'dashboard.stats.totalProfit': 'Lucro Total',
    'dashboard.stats.todayOperations': 'Operações Hoje',
    'dashboard.stats.onlineTime': 'Tempo Online',
    'dashboard.stats.activeDays': 'Dias Ativos',
    
    // Signals page
    'signals.title': 'Trades do Mercado',
    'signals.subtitle': 'Trades de alta de precisão analisados em tempo real',
    'signals.refresh': 'Atualizar',
    'signals.refresh.all': 'Atualizar Todos',
    'signals.advanced.monitoring': 'Monitoramento avançado de trades e tendências de mercado',
    'signals.filters': 'Filtros',
    'signals.type': 'Tipo de sinal',
    'signals.type.all': 'Todos',
    'signals.type.technical': 'Técnicos',
    'signals.type.fundamental': 'Fundamentalistas',
    'signals.type.news': 'Notícias',
    'signals.options': 'Opções',
    'signals.options.show.expired': 'Mostrar Expirados',
    'signals.options.hide.expired': 'Ocultar Expirados',
    'signals.options.auto.refresh': 'Auto-atualizar',
    'signals.analyzing.market': 'Analisando mercado',
    'signals.processing': 'Processando sinais e identificando as melhores oportunidades de trading',
    'signals.strength.very_strong': 'Altíssima expectativa',
    'signals.strength.strong': 'Alta expectativa',
    'signals.strength.moderate': 'Expectativa média',
    'signals.strength.weak': 'Baixa expectativa',
    'signals.expires': 'Expira',
    'signals.invalid.date': 'Data inválida',
    'signals.new': 'NOVO',
    'signals.buy': 'COMPRA',
    'signals.sell': 'VENDA',
    'signals.result.win': 'GANHO',
    'signals.result.loss': 'PERDA',
    
    // Settings
    'settings.title': 'Configurações',
    'settings.subtitle': 'Personalize a plataforma de acordo com suas preferências',
    'settings.profile': 'Perfil',
    'settings.notifications': 'Notificações',
    'settings.appearance': 'Aparência',
    'settings.sounds': 'Sons',
    'settings.language': 'Idioma',
    'settings.security': 'Privacidade & Segurança',
    'settings.account.status': 'Status da Conta',
    'settings.account.connected': 'Conectado como',
    'settings.account.active': 'Ativo',
    'settings.account.displayName': 'Nome de exibição',
    'settings.account.displayNamePlaceholder': 'Seu nome de exibição',
    'settings.account.email': 'Email',
    'settings.account.emailFixed': 'Esta informação não pode ser alterada',
    'settings.account.password': 'Senha',
    'settings.account.changePassword': 'Alterar senha',
    'settings.account.userName': 'Usuário',
    'settings.account.changeAvatar': 'Alterar foto de perfil',
    'settings.account.uploading': 'Enviando imagem...',
    'settings.account.currentPassword': 'Senha Atual',
    'settings.account.currentPasswordPlaceholder': 'Digite sua senha atual',
    'settings.account.newPassword': 'Nova Senha',
    'settings.account.newPasswordPlaceholder': 'Digite sua nova senha',
    'settings.account.confirmPassword': 'Confirmar Senha',
    'settings.account.confirmPasswordPlaceholder': 'Confirme sua nova senha',
    'settings.account.passwordMismatch': 'As senhas não coincidem',
    'settings.account.passwordTooShort': 'A senha deve ter pelo menos 8 caracteres',
    'settings.account.savePassword': 'Salvar Nova Senha',
    'settings.account.forgotPassword': 'Esqueci minha senha',
    'settings.account.passwordProtected': 'Sua senha está protegida e criptografada',
    'settings.account.passwordShown': 'Sua senha está sendo exibida no campo acima',
    'settings.account.passwordRequirements': 'Requisitos de senha',
    'settings.account.passwordMin8': 'Mínimo de 8 caracteres',
    'settings.account.passwordUppercase': 'Pelo menos uma letra maiúscula',
    'settings.account.passwordNumber': 'Pelo menos um número',
    'settings.account.passwordSpecial': 'Pelo menos um caractere especial',
    'settings.account.passwordMatch': 'Senhas coincidem',
    'settings.account.savingPassword': 'Salvando nova senha...',
    'settings.account.passwordVerified': 'Senha verificada com sucesso!',
    'settings.account.afterVerificationMessage': 'Após verificar sua identidade, você poderá visualizar sua senha.',
    'settings.account.verifying': 'Verificando...',
    'settings.account.processing': 'Processando...',
    'settings.account.verified': 'Verificado',
    'settings.account.terms': 'Ao se conectar, você concorda com nossos Termos de Serviço e Política de Privacidade.',
    'settings.account.save': 'Salvar alterações',
    'settings.account.logout': 'Desconectar',
    'settings.account.avatar.change': 'Clique no ícone para alterar sua foto',
    'settings.account.avatar.noFile': 'Nenhum arquivo escolhido',
    'settings.account.verifyPassword': 'Verificar Senha',
    'settings.account.verifyPasswordDesc': 'Para visualizar sua senha, precisamos verificar sua identidade.',
    'settings.account.enterPassword': 'Digite sua senha atual',
    'settings.account.resetPassword': 'Redefinir sua senha',
    'settings.account.resetPasswordDesc': 'Enviaremos um link para redefinir sua senha para o email abaixo.',
    'settings.account.resetPasswordNote': 'Um link de redefinição será enviado para este email. Verifique também sua pasta de spam.',
    'settings.account.resetPasswordExpire': 'O link expirará após 24 horas por motivos de segurança',
    'settings.account.changePasswordManually': 'Alterar manualmente',
    'settings.account.sendResetLink': 'Enviar link',
    'settings.account.confirmEmail': 'Confirmar Email',
    'settings.account.confirmEmailDesc': 'Digite seu email para receber o link de redefinição de senha.',
    'settings.account.accountEmail': 'Email da conta',
    'settings.account.enterYourEmail': 'Digite seu email',
    'settings.account.resetLinkWillBeSent': 'Um email com o link para redefinir sua senha será enviado para o endereço confirmado.',
    'settings.account.sendEmail': 'Enviar Email',
    'settings.account.sending': 'Enviando...',
    'settings.account.hidePassword': 'Ocultar senha',
    'settings.account.showPassword': 'Mostrar senha',
    'settings.language.description': 'Escolha o idioma da interface',
    'settings.language.select': 'Selecione um idioma',
    'settings.language.pt': 'Português',
    'settings.language.en': 'Inglês',
    'settings.language.es': 'Espanhol',
    'settings.save': 'Salvar',
    'settings.verify': 'Verificar',
    'settings.general': 'Configuraciones Generales',
    'settings.help': 'Ayuda y Soporte',
    'settings.saveSuccessMessage': 'Configuraciones guardadas con éxito',
    'settings.saveSuccessDescription': 'Todas tus preferencias han sido actualizadas.',
    'settings.saveErrorMessage': 'Error al guardar configuraciones',
    
    // Traduções para Apoie seu trader favorito
    'trader.support.title': 'Apoie seu trader favorito',
    'trader.support.subtitle': 'Configure o link para apoiar seu trader favorito',
    'trader.support.description': 'Configure o link para apoiar seu trader favorito em cada operação realizada através da plataforma.',
    'trader.support.info': 'Ao configurar um link de apoio, você ajuda seu trader favorito a continuar fornecendo análises e conteúdos de qualidade.',
    'trader.support.info.usage': 'O link será utilizado quando você acessar plataformas de negociação através do nosso aplicativo.',
    'trader.support.broker': 'Corretora',
    'trader.support.broker.placeholder': 'Selecione uma corretora',
    'trader.support.broker.hint': 'Escolha sua plataforma favorita',
    'trader.support.broker.search': 'Buscar corretora...',
    'trader.support.link': 'Link de apoiador',
    'trader.support.link.placeholder': 'https://exemplo.com/trader123',
    'trader.support.link.hint': 'URL completo do trader',
    'trader.support.use.default': 'Usar link padrão do sistema',
    'trader.support.default.info': 'O link padrão do sistema será usado para todas as operações.',
    'trader.support.instructions': 'Insira o link completo incluindo https:// para apoiar seu trader favorito.',
    'trader.support.restore': 'Restaurar padrão',
    'trader.support.save': 'Salvar preferências',
    'trader.support.saved': 'Preferências salvas com sucesso!',
    'trader.support.optional': 'Apoie seu trader favorito (opcional)',
    'trader.support.add': 'Adicione o link de apoio do seu trader favorito para contribuir com seu trabalho em cada operação.',
    'trader.support.default.empty': 'Caso não preencha, será utilizado o link padrão do sistema.',
    
    'settings.terms.title': 'Términos de Uso',
    'settings.terms.lastUpdate': 'Última actualización: 10/10/2023',
    'settings.terms.intro1': 'Estos términos y condiciones ("Términos") rigen el uso del servicio ProfEyes ("Servicio") operado por nuestra empresa.',
    'settings.terms.intro2': 'Al acceder o utilizar el Servicio, usted acepta estar sujeto a estos Términos. Si no está de acuerdo con alguna parte de los términos, no podrá acceder al Servicio.',
    'settings.terms.section1.title': '1. Cuentas',
    'settings.terms.section1.content': 'Cuando crea una cuenta con nosotros, garantiza que la información proporcionada es precisa, completa y actualizada. La información imprecisa, incompleta o desactualizada puede resultar en la terminación inmediata de su cuenta en el Servicio.',
    'settings.terms.section2.title': '2. Privacidad y Protección de Datos',
    'settings.terms.section2.content': 'Nuestra Política de Privacidad explica cómo recopilamos, utilizamos y protegemos la información que proporciona al utilizar nuestro Servicio. Al utilizar nuestro Servicio, acepta la recopilación y el uso de información en acuerdo con esta política.',
    'settings.terms.section2_5.title': '2.5. Exención de Responsabilidad',
    'settings.terms.section2_5.content': 'Trending proporciona sus servicios exclusivamente en los territorios donde está autorizada. Trending no está autorizada por la Comisión de Valores Mobiliarios de Brasil (CVM) para ofrecer directamente servicios de distribución de valores a inversores residentes, domiciliados o constituidos en la República Federativa de Brasil. Nada en este sitio web debe interpretarse como una oferta directa de servicios dirigida a estos inversores.',
    'settings.terms.section3.title': '3. Seguridad',
    'settings.terms.section3.content': 'La seguridad de su cuenta es importante para nosotros, pero recuerde que ningún método de transmisión sobre la Internet o método de almacenamiento electrónico es 100% seguro. Mientras nos esforzamos por utilizar medios comercialmente aceptables para proteger su información personal, no podemos garantizar su seguridad absoluta.',
    'settings.terms.section4.title': '4. Limitación de Responsabilidad',
    'settings.terms.section4.content': 'En ningún caso nuestra empresa, nuestros directores, oficiales, empleados, afiliados, agentes, contratistas, pasantes, proveedores, prestadores de servicios o licenciantes serán responsables por cualquier daño directo, indirecto, incidental, especial, consecuente o punitivo, incluyendo, pero no limitado a, pérdida de beneficios, datos, uso, buena voluntad u otras pérdidas intangibles, resultantes del uso o la incapacidad de usar el servicio.',
    'settings.terms.section5.title': '5. Cambios',
    'settings.terms.section5.content': 'Nos reservamos el derecho, a nuestra sola discreción, de modificar o reemplazar estos Términos en cualquier momento. Si una revisión es material, intentaremos proporcionar un aviso con al menos 30 días de anticipación antes de que los nuevos términos entren en vigor.',
    'settings.terms.section6.title': '6. Contacto',
    'settings.terms.section6.content': 'Si tiene alguna pregunta sobre estos Términos, contáctenos a través del correo electrónico soporte@profeyes.com.',
    'settings.close': 'Fechar',
    
    // Instructions
    'instructions.title': 'Instruções',
    'instructions.subtitle': 'Dicas e orientações para utilizar a plataforma',
    'instructions.back': 'Voltar',
    'instructions.intro.title': 'Introdução',
    'instructions.intro.text1': 'Bem-vindo ao app de operações do mercado financeiro! Se você está aqui, certamente deseja fazer de R$100 a R$500 todos os dias. Vou mostrar que alcançar esse resultado não é tão difícil como imagina.',
    'instructions.intro.text2': 'Aqui não prometemos que você ficará rico ou milionário do dia para a noite. Nosso objetivo é provar que você pode ter resultados consistentes e lucrativos no mercado financeiro.',
    'instructions.intro.text3': 'Não se trata de cassino ou brincadeira - estamos falando do mercado financeiro real, com operações de day trade, câmbio e criptomoedas.',
    'instructions.intro.subtitle': 'Conheça nossa plataforma',
    'instructions.operation.title': 'Como Operar',
    'instructions.operation.subtitle': 'Guia passo a passo',
    'instructions.gale.title': 'Estratégia de Gale (Reentradas)',
    'instructions.gale.subtitle': 'Maximize seus resultados',
    'instructions.select.section': 'Selecione uma seção para começar',
    'instructions.select.description': 'Escolha uma das opções acima para explorar os detalhes sobre como utilizar nossa plataforma e maximizar seus resultados.',
    'instructions.start.now': 'Comece a operar agora mesmo',
    'instructions.platform.description': 'O Trending facilita o acesso ao mercado financeiro com nossa tecnologia exclusiva.',
    'instructions.open.broker': 'Abrir Corretora',
    
    // Novos textos para página de instruções
    'instructions.welcome.title': 'Bem-vindo ao Trending',
    'instructions.welcome.subtitle': 'Transforme conhecimento em resultados reais e consistentes',
    'instructions.operations.3hours': 'Operações em 3 horários',
    'instructions.operations.3hours.desc': 'Manhã, tarde e noite. Escolha o melhor momento para operar conforme sua disponibilidade.',
    'instructions.realtime.analysis': 'Análises em tempo real',
    'instructions.realtime.analysis.desc': 'Sinais ao vivo baseados em análise profissional de mercado, sem uso de robôs ou automações.',
    'instructions.dominate.operations': 'Domine as operações',
    'instructions.dominate.operations.desc': 'Siga o passo a passo para começar a operar com segurança',
    'instructions.first.steps': 'Primeiros passos',
    'instructions.register.broker': {
      text: 'Faça seu cadastro na corretora através do botão',
      link: 'https://trade.avalonbroker.io/register?aff=385853&aff_model=revenue&afftrack=mesnagensfree'
    },
    'instructions.demo.account': 'Após cadastro, você receberá uma conta demo com R$10.000 para testes',
    'instructions.real.money': 'Para operar com dinheiro real, faça um depósito (recomendamos pelo menos R$100)',
    'instructions.chart.config': 'Configure o gráfico para formato de velas e tempo de 5 minutos',
    'instructions.executing.operations': 'Executando operações',
    'instructions.market.up': 'Para mercado em alta',
    'instructions.click.buy': 'Clique no botão verde (comprar)',
    'instructions.market.down': 'Para mercado em queda',
    'instructions.click.sell': 'Clique no botão vermelho (vender)',
    'instructions.expiration.time': 'Tempo de expiração',
    'instructions.config.candle': 'Configure igual ao tempo de vela (5 minutos)',
    'instructions.important.tip': 'Dica importante',
    'instructions.follow.signals': 'Siga os trades exibidos no app, operando no momento exato indicado. A disciplina e paciência são essenciais para obter resultados consistentes no mercado financeiro.',
    'instructions.operate.indicated': 'Opere apenas nos momentos indicados',
    'instructions.keep.records': 'Mantenha registro de suas operações',
    'instructions.gale.strategy.title': 'Estratégia de Gale',
    'instructions.gale.strategy.subtitle': 'Maximize seus ganhos com nossa estratégia exclusiva de reentradas',
    'instructions.gale.strategy.desc': 'Se não conseguir lucrar na primeira tentativa, nossa estratégia de Gale (reentradas) ajuda a recuperar operações perdidas. Esta técnica consiste em dobrar o valor investido em momentos estratégicos, aumentando suas chances de recuperação.',
    'instructions.gale1': 'Gale 1',
    'instructions.gale1.desc': 'Quando a operação está perdendo, aguarde até faltarem 2 segundos para finalizar e faça uma reentrada dobrando o valor inicial da operação.',
    'instructions.double.initial': 'Dobra o valor da entrada inicial',
    'instructions.gale2': 'Gale 2',
    'instructions.gale2.desc': 'Se o Gale 1 não recuperar a operação, faça uma segunda reentrada dobrando o valor do Gale 1 quando faltarem 2 segundos para finalizar.',
    'instructions.double.gale1': 'Dobra o valor do Gale 1',
    'instructions.risk.warning': 'Cuidado com os riscos',
    'instructions.risk.warning.desc': 'Embora a estratégia de Gale possa aumentar suas chances de recuperação, ela também aumenta o risco. Nunca invista mais do que pode perder e mantenha uma gestão rigorosa do seu capital.',
    'instructions.trending.indicates': 'O Trending indica quando usar a estratégia de Gale, para ajudar você a operar com mais segurança.',
    
    // Video paths
    'video.instructions': '/tutorial-pt.mp4',
    'video.poster.instructions': '/images/instructions-poster-pt.jpg.png',
    'video.main': '/tutorial-pt.mp4',
    'ordersCanceled': 'Ordens Canceladas',
    'successRate': 'Taxa de Sucesso',
    'dailyReturns': 'Retornos Diários',
    
    // Profile
    'profile.title': 'Meu Perfil',
    'profile.description': 'Gerencie sua foto de perfil e informações pessoais',
    
    // Support
    'support.title': 'Suporte Trending',
    'support.help_topics': 'Tópicos de Ajuda Trending',
    'support.back_to_topics': 'Voltar aos tópicos',
    'support.welcome': 'Olá! Como posso ajudá-lo hoje?',
    'support.typing': 'Digitando...',
    'support.online': 'Online',
    
    support: {
      title: 'Suporte',
      subtitle: 'Como podemos ajudar você?',
      welcome: 'Olá! Como posso ajudar você hoje?',
      input_placeholder: 'Digite sua mensagem...',
      send: 'Enviar',
      online: 'Online',
      typing: 'digitando...',
      human_support: 'Também temos suporte humano disponível em horário comercial.',
      ai_disclaimer: 'Essa é uma resposta automatizada para ajudar você. Para questões complexas, recomendamos entrar em contato via email.',
      chat: {
        title: 'Suporte',
        subtitle: 'Como podemos ajudar?',
        placeholder: 'Digite sua mensagem...'
      },
      topics: {
        select_topic: 'Por favor, selecione um dos tópicos abaixo para obter ajuda.',
        help_topics: 'Tópicos de Ajuda Trending',
        back_to_topics: 'Voltar aos tópicos',
        support_trending: 'Suporte Trending'
      },
      topic_investment: {
        title: 'Investimentos',
        description: 'Informações sobre diferentes tipos de investimentos',
        q1: {
          question: 'Quanto capital devo usar para operar?',
          answer: 'Para operar com o Trending, recomendamos começar com um capital mínimo de R$100. Embora seja possível iniciar com valores menores (a partir de R$60), um capital inicial de pelo menos R$100 permite realizar entradas com valores mais significativos e, consequentemente, obter resultados mais expressivos. Se possível, iniciar com R$200 ou R$1.000 é ainda melhor, pois quanto maior seu capital, maior será seu potencial de lucro. Nossos usuários com esses valores de capital conseguem resultados consistentes entre R$100 e R$500 diariamente. É importante lembrar que você deve investir apenas o que pode se permitir perder e seguir uma estratégia de gestão de risco adequada, especialmente ao implementar as estratégias de reentrada, que exigem dobrar o valor das entradas anteriores.'
        },
        q2: {
          question: 'Quais criptomoedas são utilizadas nos trades?',
          answer: 'O aplicativo trabalha com uma variedade de criptomoedas e tokens, incluindo as principais como Bitcoin e Ethereum, mas também expandimos para tokens com alta volatilidade e potencial de lucro como TokenTrump, Celestia e outros tokens emergentes. Nossa equipe de analistas monitora constantemente o mercado para identificar os ativos com melhores oportunidades de entrada, levando em consideração liquidez, volatilidade e direção de tendência. Selecionamos sempre os ativos que apresentam padrões técnicos claros e oferecem as melhores chances de sucesso para nossas operações. As criptomoedas e tokens específicos podem variar diariamente, dependendo das condições de mercado, por isso é importante estar atento aos trades exibidos para saber exatamente qual ativo operar em cada momento.'
        },
        q3: {
          question: 'Como fazer o depósito para operar?',
          answer: 'Para fazer um depósito e começar a operar com o Trending, siga estas etapas: 1) Crie sua conta na corretora <a href="https://trade.avalonbroker.io/register?aff=385853&aff_model=revenue&afftrack=mesnagensfree" target="_blank" rel="noopener noreferrer">Avalon</a>, nossa parceira oficial 2) Após concluir o cadastro, você receberá acesso a uma conta demo com R$10.000 para testar a plataforma 3) Quando estiver pronto para operar com dinheiro real, clique na opção "Depositar" no menu principal da <a href="https://trade.avalonbroker.io/register?aff=385853&aff_model=revenue&afftrack=mesnagensfree" target="_blank" rel="noopener noreferrer">Avalon</a> 4) Selecione seu método de pagamento preferido: PIX, boleto bancário, transferência ou criptomoedas 5) Para depósitos via PIX, informe o valor desejado (recomendamos iniciar com pelo menos R$100) e siga as instruções para completar o pagamento 6) O valor será creditado em sua conta em questão de minutos após a confirmação Com o saldo disponível, você já pode começar a executar as operações baseadas nos trades que são exibidos no aplicativo.'
        }
      },
      topic_platform: {
        title: 'Plataforma',
        description: 'Ajuda com funcionalidades da plataforma',
        q1: {
          question: 'Como funciona a aba Dashboard?',
          answer: 'A aba Dashboard fornece uma visão geral dos seus trades em tempo real. Aqui você pode visualizar os trades mais recentes e outras informações relevantes para o seu trading.'
        },
        q2: {
          question: 'Qual é o propósito da aba Trades?',
          answer: 'A aba Trades é onde você recebe alertas e operações de trading. Ela mostra operações de compra e venda para diferentes ativos, baseados em análises técnicas e tendências de mercado.'
        },
        q3: {
          question: 'O que você encontra na aba Notícias?',
          answer: 'A aba Notícias apresenta as últimas atualizações e informações relevantes do mercado financeiro. Aqui você pode ficar por dentro de notícias que podem impactar seus investimentos.'
        },
        q4: {
          question: 'Como a aba Instruções pode ajudar?',
          answer: 'A aba Instruções oferece guias e tutoriais sobre como usar o aplicativo Trending. Aqui você encontra dicas e instruções detalhadas para aproveitar ao máximo as funcionalidades da plataforma.'
        },
        q5: {
          question: 'Como gerenciar notificações na aba Notificações?',
          answer: 'A aba Notificações gerencia os alertas e mensagens que você recebe no aplicativo. Aqui você pode configurar quais tipos de notificações deseja receber e como deseja ser notificado.'
        },
        q6: {
          question: 'O que você pode ajustar na aba Configurações?',
          answer: 'A aba Configurações permite que você personalize as opções do aplicativo. Aqui você pode ajustar preferências de interface, segurança e outras configurações do seu perfil.'
        }
      },
      topic_account: {
        title: 'Conta e Segurança',
        description: 'Questões sobre sua conta e segurança',
        q1: {
          question: 'Como redefinir minha senha?',
          answer: 'Para redefinir sua senha no aplicativo Trending, siga estes passos: 1) Na tela de login, clique em "Esqueci minha senha"; 2) Digite o email associado à sua conta; 3) Você receberá um email com um link para redefinição de senha; 4) Clique no link e defina uma nova senha seguindo os requisitos de segurança. Se não receber o email em alguns minutos, verifique sua pasta de spam.'
        },
        q2: {
          question: 'Como atualizar meus dados cadastrais?',
          answer: 'Para atualizar seus dados cadastrais no aplicativo Trending, acesse seu perfil clicando no ícone de usuário no canto superior direito da tela inicial. Na tela de perfil, você poderá atualizar informações como nome de exibição, foto de perfil e senha.'
        },
        q3: {
          question: 'Como cancelar minha assinatura?',
          answer: 'Para cancelar sua assinatura no Trending, acesse o menu "Configurações" e selecione "Gerenciar Assinatura". Na tela de gerenciamento, clique na opção "Cancelar Assinatura" e siga as instruções. Você precisará confirmar sua decisão e possivelmente informar o motivo do cancelamento. Após a confirmação, sua assinatura continuará ativa até o final do período já pago, sem renovação automática. Todo seu histórico e dados ficarão preservados por 90 dias, caso decida retornar. Se preferir, você também pode entrar em contato com nosso suporte para assistência no processo de cancelamento. Lembre-se que oferecemos opções de pausar sua assinatura temporariamente, caso esteja considerando um cancelamento por motivos temporários.'
        }
      },
      topic_feedback: {
        title: 'Feedback',
        description: 'Perguntas e respostas sobre feedbacks e resultados',
        q1: {
          question: 'Quantos traders profissionais construíram o Trending?',
          answer: 'O Trending foi construído por mais de 700 traders profissionais, garantindo uma base sólida de conhecimento e experiência.'
        },
        q2: {
          question: 'Quantos ativos são monitorados?',
          answer: 'Atualmente, mais de 500 ativos são monitorados pelo Trending, proporcionando uma ampla gama de oportunidades de trading.'
        },
        q3: {
          question: 'Quantos beta testers participaram?',
          answer: 'Mais de 3200 beta testers participaram da fase beta do aplicativo Trending, ajudando a refinar e melhorar a plataforma.'
        },
        q4: {
          question: 'Qual é a taxa de satisfação dos beta testers?',
          answer: 'A taxa de satisfação dos beta testers que participaram do teste do aplicativo na fase beta é de 95%, refletindo a qualidade e eficácia da plataforma.'
        }
      }
    },
    
    // Traduções para a seção de transmissões ao vivo
    live: {
      title: 'Transmissões Ao Vivo',
      subtitle: 'Assista e interaja com transmissões ao vivo da comunidade',
      description: 'Compartilhe seu conhecimento, interaja em tempo real e aprenda com especialistas do mercado financeiro.',
      active_streams: 'Transmissões Ativas',
      active_count: '{{count}} ao vivo',
      no_active: 'Nenhuma transmissão ativa no momento',
      no_streams_message: 'Nenhuma transmissão ativa no momento. Volte mais tarde.',
      status: 'AO VIVO',
      tab_live: 'Ao Vivo',
      tab_scheduled: 'Agendadas',
      all_categories: 'Todas categorias',
      search_placeholder: 'Pesquisar transmissões',
      loading_title: 'Carregando transmissões',
      loading_message: 'Aguarde enquanto buscamos as transmissões disponíveis...',
      no_live_title: 'Nenhuma transmissão ao vivo',
      no_live_message: 'No momento não há transmissões acontecendo.',
      no_scheduled_message: 'Não há transmissões agendadas para acontecer em breve.',
      comments: 'Comentários ao vivo',
      no_comments: 'Seja o primeiro a comentar',
      type_comment: 'Digite seu comentário...',
      streaming_placeholder: 'Transmissão ao vivo',
      about: 'Sobre esta transmissão',
      end_stream: 'Encerrar',
      
      // Para streamers
      start_streaming: 'Iniciar Transmissão',
      start_streaming_desc: 'Configure sua transmissão e compartilhe com a comunidade',
      stream_title: 'Título da transmissão',
      stream_description: 'Descrição (opcional)',
      title_placeholder: 'Ex: Análises de mercado ao vivo',
      description_placeholder: 'Descreva o conteúdo da sua transmissão',
      go_live: 'Iniciar transmissão',
      
      // Para espectadores
      no_permission_title: 'Selecione uma transmissão',
      no_permission_desc: 'Selecione uma das transmissões ativas ou aguarde até que um especialista inicie uma nova transmissão.',
      
      // Mensagens de erro
      error: {
        title_required: 'Título da transmissão é obrigatório',
        media_access: 'Não foi possível acessar sua câmera ou microfone. Verifique as permissões.'
      },
      modal: {
        title: 'Nova Transmissão',
        description: 'Configure sua transmissão e compartilhe seus conhecimentos ao vivo',
        title_label: 'Título da Transmissão',
        description_label: 'Descrição',
        category_label: 'Categoria',
        category_placeholder: 'Selecione uma categoria',
        privacy_label: 'Privacidade',
        start_now: 'Iniciar agora',
        schedule: 'Agendar',
        create_stream: 'Criar Transmissão'
      }
    },
    
    // Traduções para a seção de reuniões
    meetings: {
      title: 'Reuniões',
      subtitle: 'Crie e participe de reuniões com outros usuários',
      active_meetings: 'Reuniões Ativas',
      create_meeting: 'Criar Nova Reunião',
      meeting_title: 'Título da Reunião',
      meeting_description: 'Descrição (opcional)',
      title_placeholder: 'Ex: Revisão de Sinais Semanais',
      description_placeholder: 'Ex: Discussão sobre os sinais da semana',
      start_meeting: 'Iniciar Reunião',
      creating_meeting: 'Criando Reunião...',
      no_active_meetings: 'Não há reuniões ativas no momento',
      participants: 'participantes',
      join: 'Entrar',
      end_meeting: 'Reunião encerrada com sucesso',
      copy_link: 'Link copiado',
      link_copied: 'Link da reunião copiado para a área de transferência',
      about: {
        title: 'Sobre as Reuniões',
        intro: 'A funcionalidade de reuniões permite que você crie e participe de videoconferências diretamente na plataforma.',
        how_works: 'Como funciona',
        benefits: 'Benefícios',
        features: {
          permission: 'Apenas usuários com permissão podem criar reuniões',
          google_meet: 'As reuniões são realizadas através do Google Meet',
          join: 'Qualquer usuário pode participar de reuniões ativas',
          share: 'Compartilhe o link da reunião facilmente',
          screen_sharing: 'Compartilhamento de tela para análises em tempo real',
          chat: 'Chat integrado para discussões',
          quality: 'Alta qualidade de áudio e vídeo',
          stability: 'Conexão estável e segura'
        }
      },
      error: {
        title_required: 'O título da reunião é obrigatório',
        permission_denied: 'Você não tem permissão para criar reuniões',
        create_failed: 'Falha ao criar reunião',
        end_failed: 'Falha ao encerrar a reunião'
      },
      demo: {
        title: 'Demonstração da Funcionalidade',
        description: 'Esta página é uma demonstração da funcionalidade de reuniões.',
        create_hint: 'Try creating a meeting by clicking the button above.',
        features_title: 'Available Features',
        feature_1: 'Create meetings with title and description',
        feature_2: 'View active meetings',
        feature_3: 'Join existing meetings',
        feature_4: 'End your own meetings',
        feature_5: 'Share meeting link',
        coming_soon: 'Coming Soon',
        soon_1: 'Meeting scheduling',
        soon_2: 'Automatic recording',
        soon_3: 'Meeting transcription',
        soon_4: 'Calendar integration'
      }
    },

    // Timezone
    'timezone.label': 'Fuso Horário',
    'timezone.select': 'Selecione seu fuso horário',
    'timezone.selector': 'Fusos Horários',
    'timezone.current': 'Fuso horário atual',
    'timezone.dst': 'Horário de Verão Ativo',
    'timezone.system': 'Fuso do sistema',
    'timezone.changed': 'Fuso horário alterado para',
    'timezone.updated': 'Horários atualizados com sucesso',

    // Profile errors and success messages
    'profile.error.needLogin': 'Você precisa estar logado para realizar esta ação',
    'profile.success.updated': 'Perfil atualizado com sucesso!',
    'profile.error.updateFailed': 'Falha ao atualizar o perfil. Tente novamente.',
    'profile.error.invalidImage': 'Por favor, selecione uma imagem válida.',
    'profile.error.imageSize': 'A imagem deve ter menos de 5MB.',
    'profile.error.invalidEmailFormat': 'Formato de email inválido',
    'profile.error.resetPasswordFailed': 'Falha ao enviar email de redefinição',
    'profile.submit.saving': 'Salvando...',
    'profile.submit.save': 'Salvar alterações',

    // 404 Page
    'notfound.title': 'Página não encontrada',
    'notfound.subtitle': 'Oops! Página não encontrada',
    'notfound.message': 'A página que você está procurando não existe ou foi removida.',
    'notfound.button': 'Voltar à página inicial',
    
    // Settings Account
    'settings.account.verified_status': 'Verificado',
    'settings.account.emailSentSuccess': 'Email enviado com sucesso',
    'settings.account.resetPasswordEmailSent': 'Um link para redefinir sua senha foi enviado para',
    'settings.account.checkYourInbox': 'Verifique sua caixa de entrada',
    'settings.account.openMyEmail': 'Abrir meu email',
    // Notifications
    'notifications.center': 'Centro de Notificações',
    'notifications.manage': 'Gerencie suas notificações e configure suas preferências',
    'notifications.overview': 'Visão geral das suas notificações',
    'notifications.total': 'Total de notificações',
    'notifications.unread': 'Não lidas',
    'notifications.read': 'Lidas',
    'notifications.byType': 'Por tipo',
    'notifications.yours': 'Suas Notificações',
    'notifications.markAll': 'Marcar todas',
    'notifications.markAllAsRead': 'Marcar todas como lidas',
    'notifications.clearAll': 'Limpar todas',
    'notifications.removeAll': 'Remover todas as notificações',
    'notifications.filter': 'Filtrar notificações',
    'notifications.filterByType': 'Filtrar por tipo',
    'notifications.all': 'Todas',
    'notifications.display': 'Exibição',
    'notifications.onlyUnread': 'Apenas não lidas',
    'notifications.settings': 'Configurações de notificações',
    'notifications.filteringByType': 'Filtrando por tipo',
    'notifications.notFound': 'Nenhuma notificação encontrada',
    'notifications.allRead': 'Você já leu todas as suas notificações',
    'notifications.noneOfType': 'Nenhuma notificação deste tipo foi encontrada',
    'notifications.willAppearHere': 'Quando houver novidades, elas aparecerão aqui',
    'notifications.noUnread': 'Nenhuma notificação não lida',
    'notifications.recent': 'Notificações recentes',
    'notifications.viewAll': 'Ver todas',
    'notifications.none': 'Nenhuma notificação',
    'notifications.markAsRead': 'Marcar como lidas',
    
    // Tipos de notificação
    'notifications.types.signals': 'Trades',
    'notifications.types.live': 'Transmissões ao Vivo',
    'notifications.types.signalsDesc': 'Notificações sobre trades de compra e venda',
    'notifications.types.liveDesc': 'Notificações quando uma transmissão ao vivo é iniciada',
    
    // Configurações de notificações
    'notifications.settings.title': 'Configurações de Notificações',
    'notifications.settings.description': 'Escolha quais tipos de notificações deseja receber',
    'notifications.settings.enable': 'Notificações',
    'notifications.settings.enableDesc': 'Ativar ou desativar todas as notificações',
    'notifications.settings.typesTitle': 'Tipos de Notificação',
    'notifications.settings.typesDesc': 'Selecione quais tipos de notificação deseja receber',
    'notifications.settings.cancel': 'Cancelar',
    'notifications.settings.testSignal': 'Enviar Sinal de Teste',
    'notifications.settings.save': 'Salvar',
    'notifications.settings.saved': 'Salvo!',
    
    // Sinais - notificação prévia
    'signals.upcoming': 'Sinal de',
    'signals.prepare': 'Prepare-se para operar',
    'signals.notification': 'Notificação prévia de sinal',
    'signals.minutes_before': '5 minutos antes do sinal',
  },
  en: {
    'nav.home': 'Start',
    'nav.dashboard': 'Dashboard',
    'nav.settings': 'Settings',
    'nav.instructions': 'Instructions',
    'nav.signals': 'Trades',
    'nav.signals.title': 'Market Trades',
    'nav.news': 'News',
    'nav.news.title': 'Market News',
    'nav.news.none': 'No news available',
    'nav.notifications': 'Notifications',
    'nav.notifications.read': 'Read Notifications',
    'nav.settings.notifications': 'User Area',
    'nav.system.status': 'System Status',
    'nav.system.online': 'Online',
    'nav.support': 'Support',
    'nav.live': 'Live',
    'nav.meetings': 'Meetings',
    'nav.toggle.sidebar': 'Toggle Sidebar',
    'nav.admin': 'Administration',
    'news.subtitle': 'Follow the latest news from the cryptocurrency and finance market',
    'news.refresh': 'To update',
    'news.updated': 'Updated!',
    'news.loading': 'Looking for the latest market news...',
    'news.error.loading': 'Error loading news',
    'news.error.tryAgain': 'Please try again later.',
    'news.tryAgain': 'Try again',
    'news.none': 'No news available at this time.',
    'news.filter.label': 'Filter by:',
    'news.filter.all': 'All',
    'news.filter.markets': 'Markets & Trading',
    'news.filter.economy': 'Economy & Politics',
    'news.filter.tech': 'Technology & Innovation',
    'news.filter.commodities': 'Commodities & ESG',
    'news.filter.global': 'Global & Geopolitics',
    'news.filter.noResults': 'No news found for',
    'news.filter.totalAvailable': 'Total available:',
    'news.filter.news': 'news',
    'news.filter.viewAll': 'See all',
    'common.cancel': 'Cancel',
    'common.saving': 'Saving...',
    'common.saved': 'Saved',
    'common.loading': 'Loading...',
    'common.error': 'Error',
    'common.success': 'Success',
    'common.summary': 'Summary',
    'profile.name.addHint': 'Add a name to personalize your profile',
    'profile.error.emptyName': 'Please enter a display name',
    'dashboard.title': 'Follow the market in real time',
    'dashboard.market.opportunities': 'Market opportunities based on real-time data analysis',
    'dashboard.refresh.all': 'Update All',
    'dashboard.signals.title': 'Bullish Trades',
    'dashboard.signals.entry': 'Prohibited',
    'dashboard.signals.expiration': 'Expiration',
    'dashboard.signals.reentry1': 'Reentry 1',
    'dashboard.signals.reentry2': 'Reentry 2',
    'dashboard.signals.updated': 'Updated',
    'dashboard.signals.trade': 'Trade',
    'dashboard.signals.loading': 'Loading signs...',
    'dashboard.signals.loading_error': 'Failed to load trades',
    'dashboard.signals.loading_error_desc': 'Unable to obtain trading trades at this time.',
    'dashboard.signals.view_all': 'See all',
    'dashboard.signals.realtime': 'Real-Time Trades',
    'dashboard.signals.waiting': 'Waiting for new signs...',
    'dashboard.stats.totalSignals': 'Total Trades',
    'dashboard.stats.successRate': 'Hit Rate',
    'dashboard.stats.monthlyGain': 'Monthly Earning',
    'dashboard.stats.monthlyLoss': 'Monthly Loss',
    'dashboard.stats.totalProfit': 'Total Profit',
    'dashboard.stats.todayOperations': 'Operations Today',
    'dashboard.stats.onlineTime': 'Online Weather',
    'dashboard.stats.activeDays': 'Active Days',
    'signals.title': 'Market Trades',
    'signals.subtitle': 'High-precision trades analyzed in real time',
    'signals.refresh': 'To update',
    'signals.refresh.all': 'Update All',
    'signals.advanced.monitoring': 'Advanced monitoring of trades and market trends',
    'signals.filters': 'Filters',
    'signals.type': 'Trade type',
    'signals.type.all': 'All',
    'signals.type.technical': 'Technicians',
    'signals.type.fundamental': 'Fundamentalists',
    'signals.type.news': 'News',
    'signals.options': 'Options',
    'signals.options.show.expired': 'Show Expired',
    'signals.options.hide.expired': 'Hide Expired',
    'signals.options.auto.refresh': 'Auto-update',
    'signals.analyzing.market': 'Analyzing market',
    'signals.processing': 'Processing trades and identifying the best trading opportunities',
    'signals.strength.very_strong': 'Very high expectations',
    'signals.strength.strong': 'High expectations',
    'signals.strength.moderate': 'Average expectation',
    'signals.strength.weak': 'Low expectation',
    'signals.expires': 'Expires',
    'signals.invalid.date': 'Invalid date',
    'signals.new': 'NEW',
    'signals.buy': 'BUY',
    'signals.sell': 'SALE',
    'signals.result.win': 'GAIN',
    'signals.result.loss': 'LOSS',
    'settings.title': 'Settings',
    'settings.subtitle': 'Customize the platform according to your preferences',
    'settings.profile': 'Profile',
    'settings.notifications': 'Notifications',
    'settings.appearance': 'Appearance',
    'settings.sounds': 'Sounds',
    'settings.language': 'Language',
    'settings.security': 'Privacy & Security',
    'settings.account.status': 'Account Status',
    'settings.account.connected': 'Connected as',
    'settings.account.active': 'Active',
    'settings.account.displayName': 'Display name',
    'settings.account.displayNamePlaceholder': 'Your display name',
    'settings.account.email': 'E-mail',
    'settings.account.emailFixed': 'This information cannot be changed',
    'settings.account.password': 'Password',
    'settings.account.changePassword': 'Change password',
    'settings.account.userName': 'User',
    'settings.account.changeAvatar': 'Change profile photo',
    'settings.account.uploading': 'Sending image...',
    'settings.account.currentPassword': 'Current Password',
    'settings.account.currentPasswordPlaceholder': 'Enter your current password',
    'settings.account.newPassword': 'New Password',
    'settings.account.newPasswordPlaceholder': 'Enter your new password',
    'settings.account.confirmPassword': 'Confirm Password',
    'settings.account.confirmPasswordPlaceholder': 'Confirm your new password',
    'settings.account.passwordMismatch': 'Passwords do not match',
    'settings.account.passwordTooShort': 'Password must be at least 8 characters long',
    'settings.account.savePassword': 'Save New Password',
    'settings.account.forgotPassword': 'I forgot my password',
    'settings.account.passwordProtected': 'Your password is protected and encrypted',
    'settings.account.passwordShown': 'Your password is displayed in the field above',
    'settings.account.passwordRequirements': 'Password Requirements',
    'settings.account.passwordMin8': 'Minimum 8 characters',
    'settings.account.passwordUppercase': 'At least one capital letter',
    'settings.account.passwordNumber': 'At least one number',
    'settings.account.passwordSpecial': 'At least one special character',
    'settings.account.passwordMatch': 'Passwords match',
    'settings.account.savingPassword': 'Saving new password...',
    'settings.account.passwordVerified': 'Password verified successfully!',
    'settings.account.afterVerificationMessage': 'After verifying your identity, you will be able to view your password.',
    'settings.account.verifying': 'Checking...',
    'settings.account.processing': 'Processing...',
    'settings.account.verified': 'Verified',
    'settings.account.terms': 'By connecting, you agree to our Terms of Service and Privacy Policy.',
    'settings.account.save': 'Save changes',
    'settings.account.logout': 'Disconnect',
    'settings.account.avatar.change': 'Click on the icon to change your photo',
    'settings.account.avatar.noFile': 'No file chosen',
    'settings.account.verifyPassword': 'Verify Password',
    'settings.account.verifyPasswordDesc': 'To view your password, we need to verify your identity.',
    'settings.account.enterPassword': 'Enter your current password',
    'settings.account.resetPassword': 'Reset your password',
    'settings.account.resetPasswordDesc': 'We will send a link to reset your password to the email below.',
    'settings.account.resetPasswordNote': 'A reset link will be sent to this email. Also check your spam folder.',
    'settings.account.resetPasswordExpire': 'The link will expire after 24 hours for security reasons',
    'settings.account.changePasswordManually': 'Change manually',
    'settings.account.sendResetLink': 'Send link',
    'settings.account.confirmEmail': 'Confirm Email',
    'settings.account.confirmEmailDesc': 'Enter your email to receive the password reset link.',
    'settings.account.accountEmail': 'Account email',
    'settings.account.enterYourEmail': 'Enter your email',
    'settings.account.resetLinkWillBeSent': 'An email with the link to reset your password will be sent to the confirmed address.',
    'settings.account.sendEmail': 'Send Email',
    'settings.account.sending': 'Sending...',
    'settings.account.hidePassword': 'Hide password',
    'settings.account.showPassword': 'Show password',
    'settings.language.description': 'Choose the interface language',
    'settings.language.select': 'Select a language',
    'settings.language.pt': 'Portuguese',
    'settings.language.en': 'English',
    'settings.language.es': 'Spanish',
    'settings.save': 'Save',
    'settings.verify': 'To check',
    'settings.general': 'General Settings',
    'settings.help': 'Help and Support',
    'settings.saveSuccessMessage': 'Settings saved successfully',
    'settings.saveSuccessDescription': 'All your preferences have been updated.',
    'settings.saveErrorMessage': 'Error when saving settings',
    'trader.support.title': 'Support your favorite trader',
    'trader.support.subtitle': 'Set up the link to support your favorite trader',
    'trader.support.description': 'Configure the link to support your favorite trader in each operation carried out through the platform.',
    'trader.support.info': 'By setting up a support link, you help your favorite trader continue to provide quality analysis and content.',
    'trader.support.info.usage': 'The link will be used when you access trading platforms through our application.',
    'trader.support.broker': 'Broker',
    'trader.support.broker.placeholder': 'Select a broker',
    'trader.support.broker.hint': 'Choose your favorite platform',
    'trader.support.broker.search': 'Search broker...',
    'trader.support.link': 'Supporter link',
    'trader.support.link.placeholder': 'https://example.com/trader123',
    'trader.support.link.hint': 'Full trader URL',
    'trader.support.use.default': 'Use system default link',
    'trader.support.default.info': 'The system default link will be used for all operations.',
    'trader.support.instructions': 'Enter the full link including https:// to support your favorite trader.',
    'trader.support.restore': 'Restore default',
    'trader.support.save': 'Save preferences',
    'trader.support.saved': 'Preferences saved successfully!',
    'trader.support.optional': 'Support your favorite trader (optional)',
    'trader.support.add': 'Add your favorite trader\'s support link to contribute your work on each trade.',
    'trader.support.default.empty': 'If you do not fill it out, the system\'s default link will be used.',
    'settings.terms.title': 'Terms of Use',
    'settings.terms.lastUpdate': 'Last updated: 10/10/2023',
    'settings.terms.intro1': 'These terms and conditions ("Terms") apply to the use of the ProfEyes service ("Service") operated by our company.',
    'settings.terms.intro2': 'By accessing or using the Service, you agree to be subject to these Terms. If you do not agree with any part of the terms, you will not be able to access the Service.',
    'settings.terms.section1.title': '1. Accounts',
    'settings.terms.section1.content': 'When you create an account with us, you ensure that the information provided is accurate, complete and up-to-date. Inaccurate, incomplete or outdated information may result in the immediate termination of your account in the Service.',
    'settings.terms.section2.title': '2. Privacy and Data Protection',
    'settings.terms.section2.content': 'Our Privacy Policy explains how we collect, use and protect the information provided when using our Service. When using our Service, you accept the collection and use of information in accordance with this policy.',
    'settings.terms.section2_5.title': '2.5. Exemption from Liability',
    'settings.terms.section2_5.content': 'Trending provides its services exclusively in the territories where it is authorized. Trending is not authorized by the Brazilian Securities Commission (CVM) to directly offer value distribution services to resident investors, domiciled or incorporated in the Federative Republic of Brazil. Nothing on this website should be construed as a direct offer of services directed to these inverters.',
    'settings.terms.section3.title': '3. Security',
    'settings.terms.section3.content': 'The security of your account is important for us, but remember that no transmission method over the Internet or electronic storage method is 100% secure. While we strive to use commercially acceptable means to protect your personal information, we cannot guarantee its absolute security.',
    'settings.terms.section4.title': '4. Limitation of Liability',
    'settings.terms.section4.content': 'In no case will our company be responsible for any direct, indirect, incidental, special, consequential or punitive damage, including, but not limited to, loss of benefits, data, use, good will or others. intangible losses, resulting from the use or inability to use the service.',
    'settings.terms.section5.title': '5. Exchanges',
    'settings.terms.section5.content': 'We reserve the right, at our sole discretion, to modify or replace these Terms at any time. If a revision is material, we will attempt to provide at least 30 days\' notice before the new terms come into force.',
    'settings.terms.section6.title': '6. Contact',
    'settings.terms.section6.content': 'If you have any questions about these Terms, please contact us via email at soporte@profeyes.com.',
    'settings.close': 'To close',
    'instructions.title': 'Instructions',
    'instructions.subtitle': 'Tips and guidance for using the platform',
    'instructions.back': 'To go back',
    'instructions.intro.title': 'Introduction',
    'instructions.intro.text1': 'Welcome to the financial market operations app! If you are here, you certainly want to make R$100 to R$500 every day. I will show you that achieving this result is not as difficult as you might think.',
    'instructions.intro.text2': 'Here we don\'t promise that you will become rich or a millionaire overnight. Our goal is to prove that you can have consistent and profitable results in the financial market.',
    'instructions.intro.text3': 'This isn\'t a casino or a joke - we\'re talking about the real financial market, with day trading, foreign exchange and cryptocurrency operations.',
    'instructions.intro.subtitle': 'Discover our platform',
    'instructions.operation.title': 'How to Operate',
    'instructions.operation.subtitle': 'Step by step guide',
    'instructions.gale.title': 'Gale\'s Strategy (Reentries)',
    'instructions.gale.subtitle': 'Maximize your results',
    'instructions.select.section': 'Select a section to get started',
    'instructions.select.description': 'Choose one of the options above to explore the details on how to use our platform and maximize your results.',
    'instructions.start.now': 'Start trading right now',
    'instructions.platform.description': 'Trending facilitates access to the financial market with our exclusive technology.',
    'instructions.open.broker': 'Open Broker',
    'instructions.welcome.title': 'Welcome to Trending',
    'instructions.welcome.subtitle': 'Transform knowledge into real and consistent results',
    'instructions.operations.3hours': 'Operations in 3 schedules',
    'instructions.operations.3hours.desc': 'Morning, afternoon and night. Choose the best time to operate according to your availability.',
    'instructions.realtime.analysis': 'Real-time analytics',
    'instructions.realtime.analysis.desc': 'Live trades based on professional market analysis, without the use of robots or automation.',
    'instructions.dominate.operations': 'Master operations',
    'instructions.dominate.operations.desc': 'Follow the steps to start operating safely',
    'instructions.first.steps': 'First steps',
    'instructions.demo.account': 'After registration, you will receive a demo account with R$10,000 for testing',
    'instructions.real.money': 'To operate with real money, make a deposit (we recommend at least R$100)',
    'instructions.chart.config': 'Set the chart to candle format and 5 minute time',
    'instructions.executing.operations': 'Executing operations',
    'instructions.market.up': 'For bull market',
    'instructions.click.buy': 'Click on the green button (buy)',
    'instructions.market.down': 'For falling market',
    'instructions.click.sell': 'Click on the red button (sell)',
    'instructions.expiration.time': 'Expiration time',
    'instructions.config.candle': 'Set equal to candle time (5 minutes)',
    'instructions.important.tip': 'Important tip',
    'instructions.follow.signals': 'Follow the trades displayed in the app, operating at the exact time indicated. Discipline and patience are essential to obtain consistent results in the financial market.',
    'instructions.operate.indicated': 'Operate only at indicated times',
    'instructions.keep.records': 'Keep record of your operations',
    'instructions.gale.strategy.title': 'Gale\'s Strategy',
    'instructions.gale.strategy.subtitle': 'Maximize your earnings with our exclusive re-entries strategy',
    'instructions.gale.strategy.desc': 'If you fail to make a profit on the first try, our Gale strategy (re-entries) helps you recover lost trades. This technique consists of doubling the amount invested at strategic moments, increasing your chances of recovery.',
    'instructions.gale1': 'Gale 1',
    'instructions.gale1.desc': 'When the operation is losing, wait until there are 2 seconds left to finish and make a re-entry doubling the initial value of the operation.',
    'instructions.double.initial': 'Doubles the initial entry value',
    'instructions.gale2': 'Gale 2',
    'instructions.gale2.desc': 'If Gale 1 does not recover the operation, make a second re-entry doubling the value of Gale 1 when there are 2 seconds left to finish.',
    'instructions.double.gale1': 'Doubles the value of Gale 1',
    'instructions.risk.warning': 'Beware of risks',
    'instructions.risk.warning.desc': 'While Gale\'s strategy may increase your chances of recovery, it also increases your risk. Never invest more than you can afford to lose and maintain strict management of your capital.',
    'instructions.trending.indicates': 'Trending tells you when to use Gale\'s strategy to help you trade more safely.',
    'video.instructions': '/tutorial-en.mp4',
    'video.poster.instructions': '/images/instructions-poster-pt.jpg.png',
    'video.main': '/tutorial-en.mp4',
    'ordersCanceled': 'Canceled Orders',
    'successRate': 'Success Rate',
    'dailyReturns': 'Daily Returns',
    'profile.title': 'My Profile',
    'profile.description': 'Manage your profile photo and personal information',
    'support.title': 'Trending Support',
    'support.help_topics': 'Trending Help Topics',
    'support.back_to_topics': 'Back to topics',
    'support.welcome': 'Hello! How can I help you today?',
    'support.typing': 'Typing...',
    'support.online': 'Online',
    'timezone.label': 'Time zone',
    'timezone.select': 'Select your time zone',
    'timezone.selector': 'Time Zones',
    'timezone.current': 'Current time zone',
    'timezone.dst': 'Active Daylight Saving Time',
    'timezone.system': 'System spindle',
    'timezone.changed': 'Time zone changed to',
    'timezone.updated': 'Timetables updated successfully',
    'profile.error.needLogin': 'You need to be logged in to perform this action',
    'profile.success.updated': 'Profile updated successfully!',
    'profile.error.updateFailed': 'Failed to update profile. Please try again.',
    'profile.error.invalidImage': 'Please select a valid image.',
    'profile.error.imageSize': 'The image must be less than 5MB.',
    'profile.error.invalidEmailFormat': 'Invalid email format',
    'profile.error.resetPasswordFailed': 'Failed to send reset email',
    'profile.submit.saving': 'Saving...',
    'profile.submit.save': 'Save changes',
    'notfound.title': 'Page not found',
    'notfound.subtitle': 'Oops! Page not found',
    'notfound.message': 'The page you are looking for does not exist or has been removed.',
    'notfound.button': 'Return to home page',
    'settings.account.verified_status': 'Verified',
    'settings.account.emailSentSuccess': 'Email sent successfully',
    'settings.account.resetPasswordEmailSent': 'A link to reset your password has been sent to',
    'settings.account.checkYourInbox': 'Check your inbox',
    'settings.account.openMyEmail': 'Open my email',
    'notifications.center': 'Notification Center',
    'notifications.manage': 'Manage your notifications and configure your preferences',
    'notifications.overview': 'Overview of your notifications',
    'notifications.total': 'Total notifications',
    'notifications.unread': 'Unread',
    'notifications.read': 'Read',
    'notifications.byType': 'By type',
    'notifications.yours': 'Your Notifications',
    'notifications.markAll': 'Mark all',
    'notifications.markAllAsRead': 'Mark all as read',
    'notifications.clearAll': 'Clear all',
    'notifications.removeAll': 'Remove all notifications',
    'notifications.filter': 'Filter notifications',
    'notifications.filterByType': 'Filter by type',
    'notifications.all': 'All',
    'notifications.display': 'Display',
    'notifications.onlyUnread': 'Just unread',
    'notifications.settings': 'Notifications settings',
    'notifications.filteringByType': 'Filtering by type',
    'notifications.notFound': 'No notifications found',
    'notifications.allRead': 'Have you read all your notifications',
    'notifications.noneOfType': 'No notifications of this type were found',
    'notifications.willAppearHere': 'When there is news, it will appear here',
    'notifications.noUnread': 'No unread notifications',
    'notifications.recent': 'Recent notifications',
    'notifications.viewAll': 'See all',
    'notifications.none': 'No notifications',
    'notifications.markAsRead': 'Mark as read',
    'notifications.types.signals': 'Trades',
    'notifications.types.live': 'Live Streams',
    'notifications.types.signalsDesc': 'Notifications about buy and sell trades',
    'notifications.types.liveDesc': 'Notifications when a live stream starts',
    'notifications.settings.title': 'Notifications Settings',
    'notifications.settings.description': 'Choose which types of notifications you want to receive',
    'notifications.settings.enable': 'Notifications',
    'notifications.settings.enableDesc': 'Turn all notifications on or off',
    'notifications.settings.typesTitle': 'Notification Types',
    'notifications.settings.typesDesc': 'Select which types of notifications you want to receive',
    'notifications.settings.cancel': 'Cancel',
    'notifications.settings.testSignal': 'Send Test Trade',
    'notifications.settings.save': 'Save',
    'notifications.settings.saved': 'Saved!',
    'signals.upcoming': 'sign',
    'signals.prepare': 'Prepare to operate',
    'signals.notification': 'Trade advance notification',
    'signals.minutes_before': '5 minutes before the bell',
  },
  es: {
    'nav.home': 'Comenzar',
    'nav.dashboard': 'Dashboard',
    'nav.settings': 'Ajustes',
    'nav.instructions': 'Instrucciones',
    'nav.signals': 'Vientos alisios',
    'nav.signals.title': 'Operaciones de mercado',
    'nav.news': 'Noticias',
    'nav.news.title': 'Noticias del mercado',
    'nav.news.none': 'No hay noticias disponibles',
    'nav.notifications': 'Notificaciones',
    'nav.notifications.read': 'Leer notificaciones',
    'nav.settings.notifications': 'Área de usuario',
    'nav.system.status': 'Estado del sistema',
    'nav.system.online': 'En línea',
    'nav.support': 'Apoyo',
    'nav.live': 'Vivir',
    'nav.meetings': 'Reuniones',
    'nav.toggle.sidebar': 'Alternar barra lateral',
    'nav.admin': 'Administración',
    'news.subtitle': 'Siga las últimas novedades del mercado de criptomonedas y finanzas',
    'news.refresh': 'Para actualizar',
    'news.updated': '¡Actualizado!',
    'news.loading': 'Buscando las últimas novedades del mercado...',
    'news.error.loading': 'Error al cargar noticias',
    'news.error.tryAgain': 'Inténtelo de nuevo más tarde.',
    'news.tryAgain': 'Intentar otra vez',
    'news.none': 'No hay noticias disponibles en este momento.',
    'news.filter.label': 'Filtrar por:',
    'news.filter.all': 'Todo',
    'news.filter.markets': 'Mercados y comercio',
    'news.filter.economy': 'Economía y política',
    'news.filter.tech': 'Tecnología e Innovación',
    'news.filter.commodities': 'Materias primas y ESG',
    'news.filter.global': 'Global y geopolítica',
    'news.filter.noResults': 'No se encontraron noticias para',
    'news.filter.totalAvailable': 'Total disponible:',
    'news.filter.news': 'noticias',
    'news.filter.viewAll': 'Ver todo',
    'common.cancel': 'Cancelar',
    'common.saving': 'Ahorro...',
    'common.saved': 'Guardado',
    'common.loading': 'Cargando...',
    'common.error': 'Error',
    'common.success': 'Éxito',
    'common.summary': 'Resumen',
    'profile.name.addHint': 'Añade un nombre para personalizar tu perfil',
    'profile.error.emptyName': 'Por favor ingresa un nombre para mostrar',
    'dashboard.title': 'Sigue el mercado en tiempo real',
    'dashboard.market.opportunities': 'Oportunidades de mercado basadas en análisis de datos en tiempo real',
    'dashboard.refresh.all': 'Actualizar todo',
    'dashboard.signals.title': 'Operaciones alcistas',
    'dashboard.signals.entry': 'Prohibido',
    'dashboard.signals.expiration': 'Vencimiento',
    'dashboard.signals.reentry1': 'Reingreso 1',
    'dashboard.signals.reentry2': 'Reingreso 2',
    'dashboard.signals.updated': 'Actualizado',
    'dashboard.signals.trade': 'Comercio',
    'dashboard.signals.loading': 'Cargando trades...',
    'dashboard.signals.loading_error': 'No se pudieron cargar las trades',
    'dashboard.signals.loading_error_desc': 'No se pueden obtener trades comerciales en este momento.',
    'dashboard.signals.view_all': 'Ver todo',
    'dashboard.signals.realtime': 'Trades en tiempo real',
    'dashboard.signals.waiting': 'Esperando nuevas trades...',
    'dashboard.stats.totalSignals': 'Trades totales',
    'dashboard.stats.successRate': 'Tasa de aciertos',
    'dashboard.stats.monthlyGain': 'Ganancia mensual',
    'dashboard.stats.monthlyLoss': 'Pérdida mensual',
    'dashboard.stats.totalProfit': 'Beneficio total',
    'dashboard.stats.todayOperations': 'Operaciones hoy',
    'dashboard.stats.onlineTime': 'El tiempo en línea',
    'dashboard.stats.activeDays': 'Días activos',
    'signals.title': 'Operaciones de mercado',
    'signals.subtitle': 'Operaciones de alta precisión analizadas en tiempo real',
    'signals.refresh': 'Para actualizar',
    'signals.refresh.all': 'Actualizar todo',
    'signals.advanced.monitoring': 'Monitoreo avanzado de operaciones y tendencias del mercado.',
    'signals.filters': 'Filtros',
    'signals.type': 'Tipo de trade',
    'signals.type.all': 'Todo',
    'signals.type.technical': 'Técnicos',
    'signals.type.fundamental': 'Fundamentalistas',
    'signals.type.news': 'Noticias',
    'signals.options': 'Opciones',
    'signals.options.show.expired': 'Mostrar caducado',
    'signals.options.hide.expired': 'Ocultar caducado',
    'signals.options.auto.refresh': 'Actualización automática',
    'signals.analyzing.market': 'analizando el mercado',
    'signals.processing': 'Procesar trades e identificar las mejores oportunidades comerciales.',
    'signals.strength.very_strong': 'Expectativas muy altas',
    'signals.strength.strong': 'Altas expectativas',
    'signals.strength.moderate': 'Expectativa promedio',
    'signals.strength.weak': 'Baja expectativa',
    'signals.expires': 'Vence',
    'signals.invalid.date': 'Fecha no válida',
    'signals.new': 'NUEVO',
    'signals.buy': 'COMPRAR',
    'signals.sell': 'VENTA',
    'signals.result.win': 'GANAR',
    'signals.result.loss': 'PÉRDIDA',
    'settings.title': 'Ajustes',
    'settings.subtitle': 'Personaliza la plataforma según tus preferencias',
    'settings.profile': 'Perfil',
    'settings.notifications': 'Notificaciones',
    'settings.appearance': 'Apariencia',
    'settings.sounds': 'sonidos',
    'settings.language': 'Idioma',
    'settings.security': 'Privacidad y seguridad',
    'settings.account.status': 'Estado de la cuenta',
    'settings.account.connected': 'Conectado como',
    'settings.account.active': 'Activo',
    'settings.account.displayName': 'Nombre para mostrar',
    'settings.account.displayNamePlaceholder': 'Tu nombre para mostrar',
    'settings.account.email': 'Correo electrónico',
    'settings.account.emailFixed': 'Esta información no se puede cambiar.',
    'settings.account.password': 'Contraseña',
    'settings.account.changePassword': 'Cambiar la contraseña',
    'settings.account.userName': 'Usuario',
    'settings.account.changeAvatar': 'Cambiar foto de perfil',
    'settings.account.uploading': 'Enviando imagen...',
    'settings.account.currentPassword': 'Contraseña actual',
    'settings.account.currentPasswordPlaceholder': 'Ingrese su contraseña actual',
    'settings.account.newPassword': 'Nueva contraseña',
    'settings.account.newPasswordPlaceholder': 'Ingresa tu nueva contraseña',
    'settings.account.confirmPassword': 'confirmar Contraseña',
    'settings.account.confirmPasswordPlaceholder': 'Confirma tu nueva contraseña',
    'settings.account.passwordMismatch': 'Las contraseñas no coinciden',
    'settings.account.passwordTooShort': 'La contraseña debe tener al menos 8 caracteres',
    'settings.account.savePassword': 'Guardar nueva contraseña',
    'settings.account.forgotPassword': 'Olvidé mi contraseña',
    'settings.account.passwordProtected': 'Su contraseña está protegida y encriptada',
    'settings.account.passwordShown': 'Su contraseña se muestra en el campo de arriba',
    'settings.account.passwordRequirements': 'Requisitos de contraseña',
    'settings.account.passwordMin8': 'Mínimo 8 caracteres',
    'settings.account.passwordUppercase': 'Al menos una letra mayúscula',
    'settings.account.passwordNumber': 'Al menos un numero',
    'settings.account.passwordSpecial': 'Al menos un carácter especial',
    'settings.account.passwordMatch': 'Las contraseñas coinciden',
    'settings.account.savingPassword': 'Guardando nueva contraseña...',
    'settings.account.passwordVerified': '¡Contraseña verificada exitosamente!',
    'settings.account.afterVerificationMessage': 'Después de verificar su identidad, podrá ver su contraseña.',
    'settings.account.verifying': 'De cheques...',
    'settings.account.processing': 'Tratamiento...',
    'settings.account.verified': 'Verificado',
    'settings.account.terms': 'Al conectarse, acepta nuestros Términos de servicio y Política de privacidad.',
    'settings.account.save': 'Guardar cambios',
    'settings.account.logout': 'Desconectar',
    'settings.account.avatar.change': 'Haz clic en el icono para cambiar tu foto.',
    'settings.account.avatar.noFile': 'Ningún archivo elegido',
    'settings.account.verifyPassword': 'Verificar contraseña',
    'settings.account.verifyPasswordDesc': 'Para ver su contraseña, necesitamos verificar su identidad.',
    'settings.account.enterPassword': 'Ingrese su contraseña actual',
    'settings.account.resetPassword': 'Restablece tu contraseña',
    'settings.account.resetPasswordDesc': 'Le enviaremos un enlace para restablecer su contraseña al correo electrónico a continuación.',
    'settings.account.resetPasswordNote': 'Se enviará un enlace de reinicio a este correo electrónico. También revisa tu carpeta de spam.',
    'settings.account.resetPasswordExpire': 'El enlace caducará a las 24 horas por motivos de seguridad.',
    'settings.account.changePasswordManually': 'Cambiar manualmente',
    'settings.account.sendResetLink': 'Enviar enlace',
    'settings.account.confirmEmail': 'Confirmar correo electrónico',
    'settings.account.confirmEmailDesc': 'Ingrese su correo electrónico para recibir el enlace de restablecimiento de contraseña.',
    'settings.account.accountEmail': 'Correo electrónico de la cuenta',
    'settings.account.enterYourEmail': 'Introduce tu correo electrónico',
    'settings.account.resetLinkWillBeSent': 'Se enviará un correo electrónico con el enlace para restablecer su contraseña a la dirección confirmada.',
    'settings.account.sendEmail': 'Enviar correo electrónico',
    'settings.account.sending': 'Envío...',
    'settings.account.hidePassword': 'Ocultar contraseña',
    'settings.account.showPassword': 'Mostrar contraseña',
    'settings.language.description': 'Elige el idioma de la interfaz',
    'settings.language.select': 'Seleccione un idioma',
    'settings.language.pt': 'portugués',
    'settings.language.en': 'Inglés',
    'settings.language.es': 'Español',
    'settings.save': 'Ahorrar',
    'settings.verify': 'para comprobar',
    'settings.general': 'Configuraciones generales',
    'settings.help': 'Ayuda y soporte',
    'settings.saveSuccessMessage': 'Configuración guardada exitosamente',
    'settings.saveSuccessDescription': 'Todas tus preferencias han sido actualizadas.',
    'settings.saveErrorMessage': 'Error al guardar la configuración',
    'trader.support.title': 'Apoye a su comerciante favorito',
    'trader.support.subtitle': 'Configure el enlace para apoyar a su operador favorito',
    'trader.support.description': 'Configura el enlace para apoyar a tu trader favorito en cada operación realizada a través de la plataforma.',
    'trader.support.info': 'Al configurar un enlace de soporte, ayuda a su operador favorito a continuar brindando análisis y contenido de calidad.',
    'trader.support.info.usage': 'El enlace se utilizará cuando acceda a plataformas comerciales a través de nuestra aplicación.',
    'trader.support.broker': 'Corredor',
    'trader.support.broker.placeholder': 'Seleccione un corredor',
    'trader.support.broker.hint': 'Elige tu plataforma favorita',
    'trader.support.broker.search': 'Buscar corredor...',
    'trader.support.link': 'Enlace de partidario',
    'trader.support.link.placeholder': 'https://ejemplo.com/trader123',
    'trader.support.link.hint': 'URL completa del comerciante',
    'trader.support.use.default': 'Usar enlace predeterminado del sistema',
    'trader.support.default.info': 'El enlace predeterminado del sistema se utilizará para todas las operaciones.',
    'trader.support.instructions': 'Ingrese el enlace completo, incluido https://, para apoyar a su operador favorito.',
    'trader.support.restore': 'Restaurar valor predeterminado',
    'trader.support.save': 'Guardar preferencias',
    'trader.support.saved': '¡Preferencias guardadas exitosamente!',
    'trader.support.optional': 'Apoye a su comerciante favorito (opcional)',
    'trader.support.add': 'Agregue el enlace de soporte de su operador favorito para contribuir con su trabajo en cada operación.',
    'trader.support.default.empty': 'Si no lo completa, se utilizará el enlace predeterminado del sistema.',
    'settings.terms.title': 'Condiciones de uso',
    'settings.terms.lastUpdate': 'Última actualización: 10/10/2023',
    'settings.terms.intro1': 'Estos términos y condiciones ("Términos") se aplican al uso del servicio ProfEyes ("Servicio") operado por nuestra empresa.',
    'settings.terms.intro2': 'Al acceder o utilizar el Servicio, usted acepta estar sujeto a estos Términos. Si no está de acuerdo con alguna parte de los términos, no podrá acceder al Servicio.',
    'settings.terms.section1.title': '1. Cuentas',
    'settings.terms.section1.content': 'Cuando crea una cuenta con nosotros, se asegura de que la información proporcionada sea precisa, completa y actualizada. La información inexacta, incompleta o desactualizada puede resultar en la cancelación inmediata de su cuenta en el Servicio.',
    'settings.terms.section2.title': '2. Privacidad y Protección de Datos',
    'settings.terms.section2.content': 'Nuestra Política de Privacidad explica cómo recopilamos, usamos y protegemos la información proporcionada al utilizar nuestro Servicio. Al utilizar nuestro Servicio, acepta la recopilación y el uso de información de acuerdo con esta política.',
    'settings.terms.section2_5.title': '2.5. Exención de responsabilidad',
    'settings.terms.section2_5.content': 'Trending presta sus servicios exclusivamente en los territorios donde está autorizado. Trending no está autorizada por la Comisión de Valores Mobiliarios (CVM) de Brasil para ofrecer directamente servicios de distribución de valor a inversores residentes, domiciliados o constituidos en la República Federativa de Brasil. Nada en este sitio web debe interpretarse como una oferta directa de servicios dirigidos a estos inversores.',
    'settings.terms.section3.title': '3. Seguridad',
    'settings.terms.section3.content': 'La seguridad de su cuenta es importante para nosotros, pero recuerde que ningún método de transmisión por Internet o método de almacenamiento electrónico es 100% seguro. Si bien nos esforzamos por utilizar medios comercialmente aceptables para proteger su información personal, no podemos garantizar su seguridad absoluta.',
    'settings.terms.section4.title': '4. Limitación de responsabilidad',
    'settings.terms.section4.content': 'En ningún caso nuestra empresa será responsable de ningún daño directo, indirecto, incidental, especial, consecuente o punitivo, incluyendo, entre otros, pérdida de beneficios, datos, uso, buena voluntad u otros. Pérdidas intangibles, resultantes del uso o imposibilidad de utilizar el servicio.',
    'settings.terms.section5.title': '5. Intercambios',
    'settings.terms.section5.content': 'Nos reservamos el derecho, a nuestro exclusivo criterio, de modificar o reemplazar estos Términos en cualquier momento. Si una revisión es importante, intentaremos avisar con al menos 30 días de antelación antes de que los nuevos términos entren en vigor.',
    'settings.terms.section6.title': '6. Contacto',
    'settings.terms.section6.content': 'Si tiene alguna pregunta sobre estos Términos, por favor contáctenos vía correo electrónico a soporte@profeyes.com.',
    'settings.close': 'para cerrar',
    'instructions.title': 'Instrucciones',
    'instructions.subtitle': 'Consejos y orientaciones para utilizar la plataforma.',
    'instructions.back': 'para volver',
    'instructions.intro.title': 'Introducción',
    'instructions.intro.text1': '¡Bienvenido a la aplicación de operaciones del mercado financiero! Si estás aquí, seguramente querrás ganar entre R$ 100 y R$ 500 todos los días. Te mostraré que lograr este resultado no es tan difícil como podrías pensar.',
    'instructions.intro.text2': 'Aquí no prometemos que usted se hará rico o millonario de la noche a la mañana. Nuestro objetivo es demostrar que se pueden tener resultados consistentes y rentables en el mercado financiero.',
    'instructions.intro.text3': 'Esto no es un casino ni una broma: estamos hablando del mercado financiero real, con operaciones intradía, divisas y criptomonedas.',
    'instructions.intro.subtitle': 'Descubre nuestra plataforma',
    'instructions.operation.title': 'Cómo operar',
    'instructions.operation.subtitle': 'Guía paso a paso',
    'instructions.gale.title': 'La estrategia de Gale (reentradas)',
    'instructions.gale.subtitle': 'Maximiza tus resultados',
    'instructions.select.section': 'Seleccione una sección para comenzar',
    'instructions.select.description': 'Elija una de las opciones anteriores para explorar los detalles sobre cómo utilizar nuestra plataforma y maximizar sus resultados.',
    'instructions.start.now': 'Comience a operar ahora mismo',
    'instructions.platform.description': 'Trending facilita el acceso al mercado financiero con nuestra tecnología exclusiva.',
    'instructions.open.broker': 'Corredor abierto',
    'instructions.welcome.title': 'Bienvenido a Tendencias',
    'instructions.welcome.subtitle': 'Transformar el conocimiento en resultados reales y consistentes',
    'instructions.operations.3hours': 'Operaciones en 3 horarios.',
    'instructions.operations.3hours.desc': 'Mañana, tarde y noche. Elija el mejor horario para operar según su disponibilidad.',
    'instructions.realtime.analysis': 'Análisis en tiempo real',
    'instructions.realtime.analysis.desc': 'Trades en vivo basadas en análisis de mercado profesionales, sin uso de robots ni automatización.',
    'instructions.dominate.operations': 'Operaciones maestras',
    'instructions.dominate.operations.desc': 'Sigue los pasos para empezar a operar de forma segura',
    'instructions.first.steps': 'Pinitos',
    'instructions.demo.account': 'Después del registro, recibirá una cuenta demo con R$ 10.000 para realizar pruebas',
    'instructions.real.money': 'Para operar con dinero real, haga un depósito (recomendamos al menos R$100)',
    'instructions.chart.config': 'Configure el gráfico en formato de vela y tiempo de 5 minutos.',
    'instructions.executing.operations': 'Ejecutando operaciones',
    'instructions.market.up': 'Para el mercado alcista',
    'instructions.click.buy': 'Haga clic en el botón verde (comprar)',
    'instructions.market.down': 'Por la caída del mercado',
    'instructions.click.sell': 'Haga clic en el botón rojo (vender)',
    'instructions.expiration.time': 'tiempo de vencimiento',
    'instructions.config.candle': 'Establecer igual al tiempo de la vela (5 minutos)',
    'instructions.important.tip': 'Consejo importante',
    'instructions.follow.signals': 'Siga las operaciones que se muestran en la aplicación, operando en el horario exacto indicado. La disciplina y la paciencia son esenciales para obtener resultados consistentes en el mercado financiero.',
    'instructions.operate.indicated': 'Operar sólo en los horarios indicados.',
    'instructions.keep.records': 'Mantenga un registro de sus operaciones',
    'instructions.gale.strategy.title': 'La estrategia de Gale',
    'instructions.gale.strategy.subtitle': 'Maximiza tus ganancias con nuestra exclusiva estrategia de reingresos',
    'instructions.gale.strategy.desc': 'Si no logra obtener ganancias en el primer intento, nuestra estrategia Gale (reentradas) lo ayuda a recuperar las operaciones perdidas. Esta técnica consiste en duplicar el monto invertido en momentos estratégicos, aumentando tus posibilidades de recuperación.',
    'instructions.gale1': 'Vendaval 1',
    'instructions.gale1.desc': 'Cuando la operación esté perdiendo, esperar a que queden 2 segundos para finalizar y realizar un reingreso duplicando el valor inicial de la operación.',
    'instructions.double.initial': 'Duplica el valor de entrada inicial',
    'instructions.gale2': 'Vendaval 2',
    'instructions.gale2.desc': 'Si Gale 1 no recupera la operación, realizar un segundo reingreso duplicando el valor de Gale 1 cuando queden 2 segundos para finalizar.',
    'instructions.double.gale1': 'Duplica el valor de Gale 1',
    'instructions.risk.warning': 'Cuidado con los riesgos',
    'instructions.risk.warning.desc': 'Si bien la estrategia de Gale puede aumentar sus posibilidades de recuperación, también aumenta su riesgo. Nunca invierta más de lo que pueda permitirse perder y mantenga una gestión estricta de su capital.',
    'instructions.trending.indicates': 'Las tendencias le indican cuándo utilizar la estrategia de Gale para ayudarle a operar de forma más segura.',
    'video.instructions': '/tutorial-es.mp4',
    'video.poster.instructions': '/images/cartel-de-instrucciones-pt.jpg.png',
    'video.main': '/tutorial-es.mp4',
    'ordersCanceled': 'Pedidos cancelados',
    'successRate': 'Tasa de éxito',
    'dailyReturns': 'Devoluciones diarias',
    'profile.title': 'Mi perfil',
    'profile.description': 'Gestiona tu foto de perfil e información personal',
    'support.title': 'Soporte de tendencias',
    'support.help_topics': 'Temas de ayuda de actualidad',
    'support.back_to_topics': 'Volver a temas',
    'support.welcome': '¡Hola! ¿Cómo puedo ayudarte hoy?',
    'support.typing': 'Mecanografía...',
    'support.online': 'En línea',
    'timezone.label': 'Huso horario',
    'timezone.select': 'Seleccione su zona horaria',
    'timezone.selector': 'Zonas horarias',
    'timezone.current': 'Zona horaria actual',
    'timezone.dst': 'Horario de verano activo',
    'timezone.system': 'Husillo del sistema',
    'timezone.changed': 'La zona horaria cambió a',
    'timezone.updated': 'Horarios actualizados con éxito',
    'profile.error.needLogin': 'Debes iniciar sesión para realizar esta acción',
    'profile.success.updated': '¡Perfil actualizado exitosamente!',
    'profile.error.updateFailed': 'No se pudo actualizar el perfil. Por favor inténtalo de nuevo.',
    'profile.error.invalidImage': 'Por favor seleccione una imagen válida.',
    'profile.error.imageSize': 'La imagen debe tener menos de 5 MB.',
    'profile.error.invalidEmailFormat': 'Formato de correo electrónico no válido',
    'profile.error.resetPasswordFailed': 'No se pudo enviar el correo electrónico de reinicio',
    'profile.submit.saving': 'Ahorro...',
    'profile.submit.save': 'Guardar cambios',
    'notfound.title': 'Página no encontrada',
    'notfound.subtitle': '¡Ups! Página no encontrada',
    'notfound.message': 'La página que buscas no existe o ha sido eliminada.',
    'notfound.button': 'Volver a la página de inicio',
    'settings.account.verified_status': 'Verificado',
    'settings.account.emailSentSuccess': 'Correo electrónico enviado correctamente',
    'settings.account.resetPasswordEmailSent': 'Se ha enviado un enlace para restablecer su contraseña a',
    'settings.account.checkYourInbox': 'Revisa tu bandeja de entrada',
    'settings.account.openMyEmail': 'abrir mi correo electrónico',
    'notifications.center': 'Centro de notificaciones',
    'notifications.manage': 'Gestiona tus notificaciones y configura tus preferencias',
    'notifications.overview': 'Resumen de sus notificaciones',
    'notifications.total': 'Notificaciones totales',
    'notifications.unread': 'No leído',
    'notifications.read': 'Leer',
    'notifications.byType': 'Por tipo',
    'notifications.yours': 'Tus notificaciones',
    'notifications.markAll': 'Marcar todo',
    'notifications.markAllAsRead': 'Marcar todo como leído',
    'notifications.clearAll': 'Borrar todo',
    'notifications.removeAll': 'Eliminar todas las notificaciones',
    'notifications.filter': 'Filtrar notificaciones',
    'notifications.filterByType': 'Filtrar por tipo',
    'notifications.all': 'Todo',
    'notifications.display': 'Mostrar',
    'notifications.onlyUnread': 'Recién sin leer',
    'notifications.settings': 'Configuración de notificaciones',
    'notifications.filteringByType': 'Filtrar por tipo',
    'notifications.notFound': 'No se encontraron notificaciones',
    'notifications.allRead': '¿Has leído todas tus notificaciones?',
    'notifications.noneOfType': 'No se encontraron notificaciones de este tipo',
    'notifications.willAppearHere': 'Cuando haya novedades, aparecerán aquí.',
    'notifications.noUnread': 'No hay notificaciones no leídas',
    'notifications.recent': 'Notificaciones recientes',
    'notifications.viewAll': 'Ver todo',
    'notifications.none': 'Sin notificaciones',
    'notifications.markAsRead': 'Marcar como leído',
    'notifications.types.signals': 'Vientos alisios',
    'notifications.types.live': 'Transmisiones en vivo',
    'notifications.types.signalsDesc': 'Notificaciones sobre operaciones de compra y venta.',
    'notifications.types.liveDesc': 'Notificaciones cuando comienza una transmisión en vivo',
    'notifications.settings.title': 'Configuración de notificaciones',
    'notifications.settings.description': 'Elige qué tipos de notificaciones quieres recibir',
    'notifications.settings.enable': 'Notificaciones',
    'notifications.settings.enableDesc': 'Activar o desactivar todas las notificaciones',
    'notifications.settings.typesTitle': 'Tipos de notificación',
    'notifications.settings.typesDesc': 'Seleccione qué tipos de notificaciones desea recibir',
    'notifications.settings.cancel': 'Cancelar',
    'notifications.settings.testSignal': 'Enviar trade de prueba',
    'notifications.settings.save': 'Ahorrar',
    'notifications.settings.saved': '¡Salvado!',
    'signals.upcoming': 'firmar',
    'signals.prepare': 'Prepárese para operar',
    'signals.notification': 'Notificación de avance de trade',
    'signals.minutes_before': '5 minutos antes de la campana',
  },
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider = ({ children }: LanguageProviderProps) => {
  // Detectar idioma do navegador ou usar idioma salvo
  const getInitialLanguage = (): Language => {
    // Busca o idioma salvo no dispositivo
    const savedLanguage = localStorage.getItem('app-language');
    if (savedLanguage && ['pt', 'en', 'es'].includes(savedLanguage)) {
      return savedLanguage as Language;
    }
    
    // Detectar do navegador como fallback temporário
    const browserLang = navigator.language.split('-')[0];
    if (browserLang === 'pt' || browserLang === 'en' || browserLang === 'es') {
      return browserLang as Language;
    }
    
    // Padrão para inglês (será sobrescrito pela detecção de IP)
    return 'en';
  };

  const [language, setLanguageState] = useState<Language>(getInitialLanguage);
  const [isLanguageDetected, setIsLanguageDetected] = useState(false);

  // Lista de idiomas disponíveis
  const availableLanguages = [
    { code: 'pt' as Language, name: 'Português' },
    { code: 'en' as Language, name: 'English' },
    { code: 'es' as Language, name: 'Español' }
  ];

  // Efeito para detectar idioma baseado no IP na primeira visita
  useEffect(() => {
    const detectLanguageFromIP = async () => {
      try {
        // Verificar se já detectamos o idioma anteriormente
        const detectionSource = localStorage.getItem('language-detection-source');
        if (detectionSource && !isLanguageDetected) {
                    setIsLanguageDetected(true);
          return;
        }

        // Verificar se o usuário já selecionou um idioma manualmente
        const userSelectedLanguage = localStorage.getItem('user-selected-language');
        if (userSelectedLanguage) {
                    setIsLanguageDetected(true);
          return;
        }

        // Só detectar se não há idioma salvo ou se é a primeira visita
        const savedLanguage = localStorage.getItem('app-language');
        if (!savedLanguage || !isLanguageDetected) {
                    
          const detectedLanguage = await geoLocationService.detectLanguageFromIP();
          
          if (detectedLanguage && detectedLanguage !== language) {
                        setLanguageState(detectedLanguage);
            
            // Disparar evento para outros componentes
            window.dispatchEvent(new CustomEvent('language-auto-detected', {
              detail: { language: detectedLanguage, source: 'geolocation' }
            }));
          }
          
          setIsLanguageDetected(true);
        }
      } catch (error) {
        console.error('🌍 [LanguageContext] Erro na detecção automática de idioma:', error);
        setIsLanguageDetected(true);
      }
    };

    // Executar detecção apenas uma vez
    if (!isLanguageDetected) {
      detectLanguageFromIP();
    }
  }, [language, isLanguageDetected]);
  
  // ✅ NOVO: Efeito para carregar idioma do banco quando usuário logar
  useEffect(() => {
    const loadUserLanguageOnLogin = async () => {
      try {
        // Verificar se há usuário logado
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user && user.id) {
          // Carregar idioma do banco
          const { language: userLanguage } = await userService.getUserLanguage(user.id);
          
          // Se encontrou idioma no banco e é diferente do atual
          if (userLanguage && userLanguage !== language) {
            setLanguageState(userLanguage);
            localStorage.setItem('app-language', userLanguage);
            localStorage.setItem(`user-language-${user.id}`, userLanguage);
          }
        }
      } catch (error) {
        console.error('❌ [LanguageContext] Erro ao carregar idioma do usuário:', error);
      }
    };
    
    // Executar ao montar e quando o estado de autenticação mudar
    loadUserLanguageOnLogin();
    
    // Listener para mudanças no estado de autenticação
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        loadUserLanguageOnLogin();
      }
    });
    
    return () => {
      if (data?.subscription) {
        data.subscription.unsubscribe();
      }
    };
  }, []); // Executar apenas uma vez ao montar

  // Efeito para verificar se existe um idioma associado a um usuário quando ele existir
  useEffect(() => {
    try {
      const userData = localStorage.getItem('user-data');
      if (userData) {
        const user = JSON.parse(userData);
        if (user && user.id) {
          const userLanguage = localStorage.getItem(`user-language-${user.id}`);
          if (userLanguage && ['pt', 'en', 'es'].includes(userLanguage)) {
            setLanguageState(userLanguage as Language);
          }
        }
      }
    } catch (error) {
      console.error('Erro ao recuperar idioma do usuário:', error);
    }

    // Listener para idioma carregado do banco de dados
    const handleLanguageFromDB = (event: CustomEvent) => {
      const { language } = event.detail;
      if (language && ['pt', 'en', 'es'].includes(language)) {
        setLanguageState(language as Language);
      }
    };

    window.addEventListener('language-loaded-from-db', handleLanguageFromDB as EventListener);

    return () => {
      window.removeEventListener('language-loaded-from-db', handleLanguageFromDB as EventListener);
    };
  }, []);

  // Função para atualizar o idioma do usuário
  const updateUserLanguage = async (userId: string, lang: Language) => {
    try {
      // Salvar no banco de dados primeiro
      await userService.updateUserLanguage(userId, lang);
      
      // Salvar o idioma específico do usuário
      localStorage.setItem(`user-language-${userId}`, lang);
      
      // Atualizar o idioma global
      setLanguageState(lang);
      localStorage.setItem('app-language', lang);
      
      // Também atualizar nos dados do usuário para referências futuras
      const userData = localStorage.getItem('user-data');
      if (userData) {
        const user = JSON.parse(userData);
        if (user && user.id) {
          user.language = lang;
          localStorage.setItem('user-data', JSON.stringify(user));
        }
      }
    } catch (error) {
      console.error('Erro ao salvar idioma para o usuário:', error);
    }
  };

  // Função para definir o idioma
  const setLanguage = (lang: Language) => {
    // Atualizar o estado
    setLanguageState(lang);
    
    // Salvar para o dispositivo (para usuários não logados)
    localStorage.setItem('app-language', lang);
    
    // Marcar que o usuário selecionou manualmente (para não sobrescrever com detecção automática)
    localStorage.setItem('user-selected-language', lang);
    localStorage.setItem('language-detection-source', 'manual');
    
    // Tentativa de salvar para o usuário atual se ele existir
    try {
      const userData = localStorage.getItem('user-data');
      if (userData) {
        const user = JSON.parse(userData);
        if (user && user.id) {
          localStorage.setItem(`user-language-${user.id}`, lang);
        }
      }
    } catch (error) {
      console.error('Erro ao salvar idioma para o usuário:', error);
    }
  };
  
  // Função para mudar idioma (para o seletor na UI)
  const changeLanguage = (lang: Language) => {
    setLanguage(lang);
  };

  // Função de tradução
  const t = (key: string): string => {
    try {
      const value = translations[language][key];
      if (value !== undefined) {
        // Se for string, retorna diretamente
        if (typeof value === 'string') {
          return value;
        }
        // Se for objeto com propriedade 'text', retorna o texto
        if (typeof value === 'object' && value !== null && 'text' in value) {
          return (value as { text: string }).text;
        }
        // Se for outro tipo de objeto, converte para string
        return String(value);
      } else {
        console.warn(`Chave de tradução não encontrada: ${key}`);
        // Tentar buscar em pt como fallback
        const fallbackValue = translations['pt'][key];
        if (typeof fallbackValue === 'string') {
          return fallbackValue;
        }
        if (typeof fallbackValue === 'object' && fallbackValue !== null && 'text' in fallbackValue) {
          return (fallbackValue as { text: string }).text;
        }
        return key;
      }
    } catch (error) {
      console.error(`Erro ao buscar tradução para: ${key}`, error);
      return key;
    }
  };

  // Função para obter objetos traduzidos
  const tObj = <T,>(key: string): T | null => {
    try {
      const value = translations[language][key];
      if (value !== undefined) {
        return value as T;
      } else {
        console.warn(`Chave de tradução não encontrada: ${key}`);
        // Tentar buscar em pt como fallback
        const fallbackValue = translations['pt'][key];
        return fallbackValue as T || null;
      }
    } catch (error) {
      console.error(`Erro ao buscar tradução para: ${key}`, error);
      return null;
    }
  };

  // Função para carregar o idioma do usuário do banco de dados
  const loadUserLanguageFromDB = async (userId: string) => {
    try {
      const { language } = await userService.getUserLanguage(userId);
      if (language && ['pt', 'en', 'es'].includes(language)) {
        setLanguageState(language as Language);
        localStorage.setItem('app-language', language);
        localStorage.setItem(`user-language-${userId}`, language);
      }
    } catch (error) {
      console.error('Erro ao carregar idioma do usuário:', error);
    }
  };

  // Função para forçar nova detecção de idioma baseada no IP
  const forceLanguageDetection = async (): Promise<Language> => {
    try {
            
      // Limpar cache de detecção
      geoLocationService.clearCache();
      localStorage.removeItem('language-detection-source');
      localStorage.removeItem('user-selected-language');
      
      // Detectar novamente
      const detectedLanguage = await geoLocationService.detectLanguageFromIP();
      
      if (detectedLanguage) {
        setLanguageState(detectedLanguage);
                
        // Disparar evento
        window.dispatchEvent(new CustomEvent('language-auto-detected', {
          detail: { language: detectedLanguage, source: 'forced-geolocation' }
        }));
      }
      
      return detectedLanguage;
    } catch (error) {
      console.error('🌍 [LanguageContext] Erro ao forçar detecção:', error);
      return language; // Retornar idioma atual em caso de erro
    }
  };

  // Função para obter informações de detecção para debug
  const getLanguageDetectionInfo = () => {
    return geoLocationService.getDetectionInfo();
  };

  return (
    <LanguageContext.Provider value={{ 
      language, 
      setLanguage, 
      t, 
      tObj, 
      changeLanguage, 
      updateUserLanguage,
      loadUserLanguageFromDB,
      forceLanguageDetection,
      getLanguageDetectionInfo,
      availableLanguages
    }}>
      {children}
    </LanguageContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}

// eslint-disable-next-line react-refresh/only-export-components
export const useTranslation = () => {
  const { language } = useContext(LanguageContext);
  
  const t = useCallback((key: string) => {
    const translation = translations[language]?.[key];
    if (typeof translation === 'string') {
      return translation;
    }
    if (translation && typeof translation === 'object') {
      return translation;
    }
    return key;
  }, [language]);

  return { t, language };
};