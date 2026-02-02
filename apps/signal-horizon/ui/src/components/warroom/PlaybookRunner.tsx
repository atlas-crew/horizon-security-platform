import { useState, useEffect } from 'react';
import { CheckCircle, Circle, Loader2, X, Play } from 'lucide-react';
import { clsx } from 'clsx';
import type { Playbook } from './PlaybookSelector';

interface PlaybookRunnerProps {
  playbook: Playbook;
  onClose: () => void;
  onComplete: () => void;
}

export function PlaybookRunner({ playbook, onClose, onComplete }: PlaybookRunnerProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isExecuting, setIsExecuting] = useState(false);

  useEffect(() => {
    if (isExecuting && currentStep < playbook.steps.length) {
      // Simulate step execution
      const timer = setTimeout(() => {
        setCurrentStep((prev) => prev + 1);
      }, 2000); // 2 seconds per step
      return () => clearTimeout(timer);
    } else if (isExecuting && currentStep === playbook.steps.length) {
      setIsExecuting(false);
      onComplete();
    }
  }, [isExecuting, currentStep, playbook.steps.length, onComplete]);

  const handleStart = () => {
    setIsExecuting(true);
  };

  return (
    <div className="border border-ac-blue/30 bg-ac-blue/5 p-4 rounded-sm">
      <div className="flex items-center justify-between mb-4 border-b border-ac-blue/20 pb-3">
        <h3 className="font-medium text-ac-blue flex items-center gap-2">
          <Play className="w-4 h-4" />
          Running: {playbook.name}
        </h3>
        <button onClick={onClose} className="text-ink-muted hover:text-ink-primary">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-4">
        {playbook.steps.map((step, index) => {
          const isCompleted = index < currentStep;
          const isCurrent = index === currentStep && isExecuting;

          return (
            <div key={index} className="flex items-center gap-3">
              {isCompleted ? (
                <CheckCircle className="w-5 h-5 text-ac-green" />
              ) : isCurrent ? (
                <Loader2 className="w-5 h-5 text-ac-blue animate-spin" />
              ) : (
                <Circle className="w-5 h-5 text-ink-muted" />
              )}
              
              <span className={clsx(
                "text-sm transition-colors",
                isCompleted ? "text-ink-primary" :
                isCurrent ? "text-ac-blue font-medium" :
                "text-ink-muted"
              )}>
                {step.name}
              </span>
            </div>
          );
        })}
      </div>

      {!isExecuting && currentStep === 0 && (
        <button
          onClick={handleStart}
          className="mt-4 w-full btn-primary h-9 text-sm"
        >
          Execute Playbook
        </button>
      )}
      
      {!isExecuting && currentStep === playbook.steps.length && (
        <div className="mt-4 p-2 bg-ac-green/10 text-ac-green text-center text-sm font-medium border border-ac-green/20">
          Playbook Completed Successfully
        </div>
      )}
    </div>
  );
}
