'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import api from '@/lib/axios';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import EmptyState from '@/components/shared/EmptyState';
import Card from '@/components/ui/Card';
import Progress from '@/components/ui/Progress';
import axios from 'axios';
import { ShoppingCart, Download, RefreshCw, AlertTriangle, Check } from 'lucide-react';


interface GroceryItem {
  id: string;
  ingredientName: string;
  category: string;
  isChecked: boolean;
}

interface GroceryList {
  id: string;
  weekLabel: string;
  generatedAt: string;
  groceryItems: GroceryItem[];
}

export default function GroceryListPage() {
  const { user } = useAuth();
  const [groceryList, setGroceryList] = useState<GroceryList | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetches current user grocery list
  const fetchGroceryList = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.get('/user/grocery/current');
      if (res.data && res.data.success) {
        setGroceryList(res.data.data);
      }
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error || 'Failed to retrieve grocery list.');
      } else {
        setError('Failed to contact backend API.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchGroceryList();
    }
  }, [user]);

  // Generates grocery list from active meal plan
  const handleGenerateList = async () => {
    setIsGenerating(true);
    setError(null);
    try {
      const res = await api.post('/user/grocery/generate');
      if (res.data && res.data.success) {
        setGroceryList(res.data.data);
      }
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error || 'Failed to generate grocery list from meal plan.');
      } else {
        setError('Failed to reach server to compile ingredients.');
      }
    } finally {
      setIsGenerating(false);
    }
  };

  // Toggles grocery item checked status
  const handleToggleItem = async (itemId: string) => {
    if (!groceryList) return;

    // Optimistically update frontend UI
    const updatedItems = groceryList.groceryItems.map((item) => {
      if (item.id === itemId) {
        return { ...item, isChecked: !item.isChecked };
      }
      return item;
    });
    setGroceryList({ ...groceryList, groceryItems: updatedItems });

    try {
      await api.patch(`/user/grocery/items/${itemId}/toggle`);
    } catch (err) {
      console.error('[Grocery] Toggle failed, reverting state.', err);
      // Revert frontend UI on error
      fetchGroceryList();
    }
  };

  const handleDownloadPDF = async () => {
    try {
      const response = await api.get('/user/grocery/pdf', {
        responseType: 'blob',
      });
      const file = new Blob([response.data], { type: 'application/pdf' });
      const fileURL = URL.createObjectURL(file);
      const link = document.createElement('a');
      link.href = fileURL;
      link.setAttribute('download', `NutriMind_Grocery_List_${groceryList?.weekLabel || 'Current'}.pdf`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('[Grocery] Failed to download PDF:', err);
      alert('Failed to generate PDF. Make sure you have an active grocery list.');
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-[70vh] items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // Group items by category for UI render
  const getGroupedItems = () => {
    if (!groceryList) return {};
    const grouped: Record<string, GroceryItem[]> = {};
    
    groceryList.groceryItems.forEach((item) => {
      const cat = item.category || 'Other';
      if (!grouped[cat]) {
        grouped[cat] = [];
      }
      grouped[cat].push(item);
    });

    return grouped;
  };

  const groupedItems = getGroupedItems();
  const totalItems = groceryList?.groceryItems.length || 0;
  const checkedItems = groceryList?.groceryItems.filter((i) => i.isChecked).length || 0;
  const progressPercent = totalItems > 0 ? Math.round((checkedItems / totalItems) * 100) : 0;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 text-brand-text">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-brand-border/60 pb-6 mb-8 text-left">
        <div>
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-6 h-6 text-brand-green shrink-0" />
            <h1 className="text-2xl font-extrabold tracking-tight font-display text-transparent bg-clip-text bg-gradient-to-r from-brand-text via-brand-green to-brand-green">
              GROCERY SHOPPING LIST
            </h1>
          </div>
          <p className="text-xs text-brand-muted mt-1 font-semibold uppercase tracking-wider">
            Consolidated ingredients mapped from your active 7-Day meal plan
          </p>
        </div>
        {groceryList && (
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={handleDownloadPDF}
              className="flex items-center gap-2 text-xs font-semibold py-2"
            >
              <Download className="w-4 h-4" />
              <span>Download PDF</span>
            </Button>
            <Button
              variant="secondary"
              onClick={handleGenerateList}
              disabled={isGenerating}
              className="text-xs font-bold py-2 bg-brand-surface/80 border-brand-border/80 hover:bg-brand-border hover:text-brand-green transition-all flex items-center gap-1.5"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Re-compiling...</span>
                </>
              ) : (
                <>
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Regenerate List</span>
                </>
              )}
            </Button>
          </div>
        )}
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-status-error-bg/10 border border-status-error-text/25 text-status-error-text text-sm font-semibold flex items-center gap-2 text-left mb-6">
          <AlertTriangle className="w-4 h-4 text-status-error-text shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* NO ACTIVE GROCERY LIST */}
      {!groceryList ? (
        <div className="py-12">
          <EmptyState
            icon={<ShoppingCart className="h-8 w-8 text-brand-green" />}
            title="No Active Grocery Checklist"
            description="Generate a categorized shopping checklist compiling every local ingredient needed for your 7-day clinical Filipino meal plan."
            actionText="Generate Grocery Checklist"
            onAction={handleGenerateList}
          />
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          
          {/* PROGRESS METRIC BLOCK */}
          <Card className="p-5 border-brand-border/80 bg-brand-surface/40 backdrop-blur-md shadow-xl text-left">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-base font-bold text-brand-text">Shopping Progress</h3>
                <p className="text-xs text-brand-muted mt-0.5 font-medium">
                  Packed {checkedItems} out of {totalItems} ingredients needed for this week
                </p>
              </div>
              <span className="text-lg font-black text-brand-green font-display">
                {progressPercent}%
              </span>
            </div>
            <Progress value={progressPercent} className="h-2 bg-brand-border/50" />
          </Card>

          {/* GROUPS LIST STACK */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
            {Object.keys(groupedItems).map((category) => {
              const items = groupedItems[category];
              const completedCount = items.filter((i) => i.isChecked).length;
              
              return (
                <Card 
                  key={category} 
                  className="p-5 border-brand-border/60 bg-brand-surface/20 flex flex-col gap-4 shadow-lg hover:border-brand-border/90 transition-all duration-300"
                >
                  {/* Category Header */}
                  <div className="flex justify-between items-center border-b border-brand-border/40 pb-2">
                    <h3 className="text-sm font-bold text-brand-green font-display uppercase tracking-wide">
                      {category}
                    </h3>
                    <span className="text-[10px] text-brand-muted font-bold bg-brand-border/50 py-0.5 px-2 rounded-full">
                      {completedCount}/{items.length}
                    </span>
                  </div>

                  {/* Category Checklist Items */}
                  <div className="flex flex-col gap-2.5">
                    {items.map((item) => (
                      <label 
                        key={item.id}
                        onClick={() => handleToggleItem(item.id)}
                        className={`
                          flex items-center gap-3 p-2.5 rounded-xl border border-transparent 
                          cursor-pointer select-none transition-all duration-200 hover:bg-brand-surface/60
                          ${item.isChecked 
                            ? 'opacity-55 line-through decoration-brand-green/60 text-brand-muted' 
                            : 'text-brand-text'
                          }
                        `}
                      >
                        {/* Custom Animated Checkbox */}
                        <div 
                          className={`
                            w-5 h-5 rounded-md border flex items-center justify-center transition-all duration-200
                            ${item.isChecked 
                              ? 'bg-brand-green border-brand-green text-brand-background shadow-md shadow-brand-green/10' 
                              : 'border-brand-border/80 bg-brand-background hover:border-brand-green/60'
                            }
                          `}
                        >
                          {item.isChecked && <Check className="w-3.5 h-3.5 stroke-[3px]" />}
                        </div>
                        
                        <span className="text-xs font-semibold tracking-wide">
                          {item.ingredientName}
                        </span>
                      </label>
                    ))}
                  </div>
                </Card>
              );
            })}
          </div>

        </div>
      )}

    </div>
  );
}
