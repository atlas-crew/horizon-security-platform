import { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { marked } from 'marked';
import mermaid from 'mermaid';
import { API_BASE_URL, API_KEY } from '../lib/api';

const authHeaders = {
  Authorization: `Bearer ${API_KEY}`,
  'Content-Type': 'application/json',
};

// Configure marked to handle mermaid blocks
marked.use({
  renderer: {
    code({ text, lang }) {
      if (lang === 'mermaid') {
        return `<div class="mermaid">${text}</div>`;
      }
      return `<pre><code class="language-${lang}">${text}</code></pre>`;
    }
  }
});

// Initialize mermaid
mermaid.initialize({
  startOnLoad: false,
  theme: document.documentElement.classList.contains('dark') ? 'dark' : 'default',
  securityLevel: 'loose',
});

interface DocItem {
  id: string;
  title: string;
  category: string;
  path: string;
}

export function SupportPage() {

  const [activeTab, setActiveTab] = useState<'docs' | 'diagnostics' | 'contact'>('docs');

  const [selectedDocId, setSelectedDocId] = useState<string>('README');



  // Fetch doc index

  const { data: docs = [] } = useQuery<DocItem[]> ({

    queryKey: ['docs', 'index'],

    queryFn: async () => {

      const res = await fetch(`${API_BASE}/api/v1/docs`, { headers: authHeaders });

      if (!res.ok) throw new Error('Failed to fetch docs index');

      return res.json();

    }

  });



  return (

    <div className="flex flex-col h-full bg-surface-base font-sans selection:bg-ac-blue/20 text-ink-primary">

      {/* Header - Atlas Crew Brand Hub Navigation */}

      <div className="flex-shrink-0 bg-ac-navy border-b border-white/10">

        <div className="flex items-center justify-between px-8 h-16">

          <div className="flex items-center gap-10">

            <h2 className="text-base font-bold text-white uppercase tracking-[0.1em]">Support Hub</h2>

            

            <nav className="flex items-center gap-2">

              <button

                onClick={() => setActiveTab('docs')}

                className={`px-5 py-2 rounded-md text-xs font-bold uppercase tracking-wider transition-all ${

                  activeTab === 'docs' 

                    ? 'bg-ac-blue text-white shadow-lg' 

                    : 'text-white/70 hover:text-white hover:bg-white/5'

                }`}

              >

                📚 Documentation

              </button>

              <button

                onClick={() => setActiveTab('diagnostics')}

                className={`px-5 py-2 rounded-md text-xs font-bold uppercase tracking-wider transition-all ${

                  activeTab === 'diagnostics' 

                    ? 'bg-ac-magenta text-white shadow-lg' 

                    : 'text-white/70 hover:text-white hover:bg-white/5'

                }`}

              >

                🩺 System Diagnostics

              </button>

              <button

                onClick={() => setActiveTab('contact')}

                className={`px-5 py-2 rounded-md text-xs font-bold uppercase tracking-wider transition-all ${

                  activeTab === 'contact' 

                    ? 'bg-ac-sky text-ac-navy shadow-lg' 

                    : 'text-white/70 hover:text-white hover:bg-white/5'

                }`}

              >

                💬 Contact Support

              </button>

            </nav>

          </div>

          

          <div className="hidden md:block">

            <span className="text-[10px] font-bold text-white/40 uppercase tracking-[0.2em]">

              Precision Security Fleet

            </span>

          </div>

        </div>

      </div>



      {/* Main Content Area */}

      <div className="flex-1 overflow-hidden relative">

        {activeTab === 'docs' && (

          <DocumentationViewer 

            docs={docs}

            selectedDocId={selectedDocId} 

            onSelectDoc={setSelectedDocId} 

          />

        )}

        {activeTab === 'diagnostics' && (

          <div className="h-full overflow-auto bg-surface-base">

            <DiagnosticsCenter />

          </div>

        )}

        {activeTab === 'contact' && (

          <div className="h-full overflow-auto bg-surface-base flex items-center justify-center p-12">

            <ContactSupport />

          </div>

        )}

      </div>

    </div>

  );

}

function DocumentationViewer({ docs, selectedDocId, onSelectDoc }: { docs: DocItem[], selectedDocId: string, onSelectDoc: (id: string) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch doc content
  const { data: docContent, isLoading } = useQuery({
    queryKey: ['docs', 'content', selectedDocId],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/v1/docs/${selectedDocId}`, { headers: authHeaders });
      if (!res.ok) throw new Error('Failed to fetch doc content');
      return res.json();
    },
    enabled: !!selectedDocId
  });

  const content = docContent?.content || '';
  
  // Parse markdown to HTML safely
  const htmlContent = useMemo(() => {
    return marked.parse(content);
  }, [content]);

  // Run mermaid rendering when content changes
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (containerRef.current) {
        try {
          mermaid.initialize({
            theme: document.documentElement.classList.contains('dark') ? 'dark' : 'default',
            themeVariables: {
              primaryColor: '#0057B7',
              edgeLabelBackground: '#ffffff',
              tertiaryColor: '#f0f4f8',
            }
          });
          await mermaid.run({
            nodes: containerRef.current.querySelectorAll('.mermaid'),
          });
        } catch (err) {
          console.error('Mermaid rendering failed:', err);
        }
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [htmlContent]);

  // Group docs by category
  const categories = useMemo(() => {
    const groups: Record<string, DocItem[]> = {};
    docs.forEach(doc => {
      if (!groups[doc.category]) groups[doc.category] = [];
      groups[doc.category].push(doc);
    });
    return groups;
  }, [docs]);

  return (
    <div className="flex h-full overflow-hidden">
      {/* Doc Navigation - Secondary Sidebar */}
      <div className="w-72 flex-shrink-0 border-r border-border-subtle bg-surface-subtle p-6 overflow-y-auto">
        {Object.entries(categories).map(([category, items]) => (
          <div key={category} className="mb-8">
            <h3 className="text-[11px] font-bold text-ac-blue uppercase tracking-[0.15em] mb-4 pb-2 border-b border-ac-blue/10">
              {category}
            </h3>
            <div className="space-y-1.5">
              {items.map((doc) => (
                <button
                  key={doc.id}
                  onClick={() => onSelectDoc(doc.id)}
                  className={`w-full text-left px-3 py-2 rounded transition-all text-[13px] ${
                    selectedDocId === doc.id 
                      ? 'bg-white shadow-sm text-ac-navy font-bold border-l-4 border-ac-blue' 
                      : 'text-ink-secondary hover:text-ac-blue hover:translate-x-1'
                  }`}
                >
                  {doc.title}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Doc Content - Main viewport */}
      <div className="flex-1 p-16 overflow-y-auto bg-surface-base" ref={containerRef}>
        <div className="max-w-3xl mx-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-ac-blue"></div>
            </div>
          ) : (
            <div 
              className="prose prose-slate dark:prose-invert max-w-none 
                font-sans text-ink-secondary leading-relaxed
                prose-headings:font-light prose-headings:tracking-tight prose-headings:text-ac-navy dark:prose-headings:text-white
                prose-h1:text-[48px] prose-h1:mb-12
                prose-h2:text-[32px] prose-h2:mt-16 prose-h2:mb-6
                prose-h3:text-[28px] prose-h3:mt-12 prose-h3:mb-4
                prose-h4:text-[24px]
                prose-strong:font-bold prose-strong:text-ac-blue
                prose-code:bg-ac-navy/5 prose-code:text-ac-navy prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:font-mono prose-code:text-sm
                prose-pre:bg-ac-navy prose-pre:text-white prose-pre:shadow-2xl prose-pre:border-none prose-pre:rounded-xl
                prose-li:my-2"
              dangerouslySetInnerHTML={{ __html: htmlContent }} 
            />
          )}
        </div>
      </div>
    </div>
  );
}

function DiagnosticsCenter() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [bundles, setBundles] = useState([
    { id: 'bund_123', date: '2024-01-30 10:00', type: 'Full System', status: 'Ready', size: '4.2 MB' },
    { id: 'bund_122', date: '2024-01-29 14:30', type: 'Logs Only', status: 'Ready', size: '1.1 MB' },
  ]);

  const handleGenerate = () => {
    setIsGenerating(true);
    setTimeout(() => {
      setBundles(prev => [{
        id: `bund_${Math.floor(Math.random() * 1000)}`,
        date: new Date().toLocaleString(),
        type: 'Full System',
        status: 'Ready',
        size: '3.8 MB'
      }, ...prev]);
      setIsGenerating(false);
    }, 2000);
  };

  return (
    <div className="p-12 max-w-5xl mx-auto">
      <div className="flex justify-between items-end mb-12 border-b border-border-subtle pb-8">
        <div>
          <h1 className="text-[48px] font-light text-ac-navy dark:text-white tracking-tight">System Diagnostics</h1>
          <p className="text-lg text-ink-secondary mt-2">Fleet health verification and forensic bundle generation.</p>
        </div>
        <button
          onClick={handleGenerate}
          disabled={isGenerating}
          className="bg-ac-magenta hover:bg-ac-magenta/90 text-white px-8 py-3 rounded-lg font-bold uppercase tracking-widest text-xs shadow-lg transition-all active:scale-95 disabled:opacity-50"
        >
          {isGenerating ? 'Generating...' : 'Generate New Bundle'}
        </button>
      </div>

      <div className="bg-white dark:bg-surface-card shadow-card rounded-2xl overflow-hidden border border-border-subtle">
        <table className="w-full text-sm text-left">
          <thead className="bg-ac-navy text-white/70 uppercase tracking-widest text-[10px] font-bold">
            <tr>
              <th className="px-8 py-4">Bundle ID</th>
              <th className="px-8 py-4">Date Generated</th>
              <th className="px-8 py-4">Type</th>
              <th className="px-8 py-4">Size</th>
              <th className="px-8 py-4">Status</th>
              <th className="px-8 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {bundles.map((bundle) => (
              <tr key={bundle.id} className="hover:bg-ac-blue/5 transition-colors group">
                <td className="px-8 py-5 font-mono font-bold text-ac-blue">{bundle.id}</td>
                <td className="px-8 py-5 text-ink-secondary">{bundle.date}</td>
                <td className="px-8 py-5 text-ink-secondary">{bundle.type}</td>
                <td className="px-8 py-5 text-ink-secondary">{bundle.size}</td>
                <td className="px-8 py-5">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-ac-green/10 text-ac-green">
                    {bundle.status}
                  </span>
                </td>
                <td className="px-8 py-5 text-right">
                  <button className="text-ac-blue group-hover:text-ac-magenta font-bold uppercase text-xs tracking-wider transition-colors">
                    Download
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ContactSupport() {
  return (
    <div className="max-w-2xl w-full bg-white dark:bg-surface-card p-12 rounded-3xl shadow-card-strong border border-border-subtle">
      <h1 className="text-[32px] font-light text-ac-navy dark:text-white tracking-tight mb-2">Contact Support</h1>
      <p className="text-ink-secondary mb-10">Direct access to the Atlas Crew security engineering team.</p>
      
      <form className="space-y-8">
        <div>
          <label className="block text-[11px] font-bold text-ac-navy dark:text-white/60 uppercase tracking-[0.2em] mb-3">Subject</label>
          <input type="text" className="w-full px-5 py-4 rounded-xl border border-border-subtle bg-surface-subtle text-ink-primary focus:ring-2 focus:ring-ac-blue focus:border-transparent transition-all" placeholder="Brief description of the issue" />
        </div>
        <div>
          <label className="block text-[11px] font-bold text-ac-navy dark:text-white/60 uppercase tracking-[0.2em] mb-3">Message</label>
          <textarea rows={6} className="w-full px-5 py-4 rounded-xl border border-border-subtle bg-surface-subtle text-ink-primary focus:ring-2 focus:ring-ac-blue focus:border-transparent transition-all" placeholder="Describe the problem you're experiencing..." />
        </div>
        <div className="flex items-center justify-between pt-4">
          <button type="button" className="bg-ac-blue hover:bg-ac-navy text-white px-10 py-4 rounded-xl font-bold uppercase tracking-widest text-xs shadow-xl transition-all active:scale-95">
            Send Message
          </button>
          <div className="text-right">
            <p className="text-xs font-bold text-ac-magenta uppercase tracking-widest">SLA: &lt; 2 hours</p>
            <p className="text-[10px] text-ink-muted mt-1">24/7 Enterprise Support</p>
          </div>
        </div>
      </form>
    </div>
  );
}
