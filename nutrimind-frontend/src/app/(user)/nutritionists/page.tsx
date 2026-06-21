'use client';

import React, { useEffect, useState } from 'react';
import api from '@/lib/axios';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import EmptyState from '@/components/shared/EmptyState';
import { Users, AlertTriangle, Stethoscope, User, Star } from 'lucide-react';

interface Nutritionist {
  id: string;
  name: string;
  email: string;
  image: string | null;
  nutritionistProfile: {
    prcLicenseNumber: string;
    specialization: string | null;
    yearsOfExperience: number | null;
    university: string | null;
    bio: string | null;
    rating: number;
    totalVerified: number;
  } | null;
}

export default function NutritionistsDirectoryPage() {
  const [nutritionists, setNutritionists] = useState<Nutritionist[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchNutritionists = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await api.get('/user/nutritionists');
        if (res.data?.success) {
          setNutritionists(res.data.data);
        }
      } catch (err: unknown) {
        console.error('Failed to fetch nutritionists:', err);
        const axiosErr = err as { response?: { data?: { error?: string } } };
        setError(axiosErr.response?.data?.error || 'Failed to load nutritionist directory.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchNutritionists();
  }, []);

  const handleRequest = (id: string) => {
    // For now, just alert. Full assignment logic would go here.
    console.log('Requesting consultation for:', id);
    alert('Request feature coming soon!');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 text-brand-text">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-brand-border/60 pb-6 mb-8 text-left">
        <div>
          <div className="flex items-center gap-2">
            <Users className="w-6 h-6 text-brand-green shrink-0" />
            <h1 className="text-2xl font-extrabold tracking-tight font-display text-transparent bg-clip-text bg-gradient-to-r from-brand-text via-brand-green to-brand-green">
              NUTRITIONIST DIRECTORY
            </h1>
          </div>
          <p className="text-xs text-brand-muted mt-1 font-semibold uppercase tracking-wider">
            Browse and connect with verified Registered Nutritionist-Dietitians
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-status-error-bg/10 border border-status-error-text/25 text-status-error-text text-sm font-semibold flex items-center gap-2 text-left mb-6">
          <AlertTriangle className="w-4 h-4 text-status-error-text shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {nutritionists.length === 0 && !error ? (
        <div className="py-12">
          <EmptyState
            icon={<Stethoscope className="h-8 w-8 text-brand-green" />}
            title="No Nutritionists Available"
            description="There are currently no verified nutritionists in the directory. Check back later!"
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {nutritionists.map((pro) => (
            <Card key={pro.id} className="p-5 flex flex-col justify-between border border-brand-border/60 hover:border-brand-green/30 transition-all duration-300">
              <div>
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 rounded-2xl bg-brand-surface flex items-center justify-center overflow-hidden shadow-inner">
                      {pro.image ? (
                        <img src={pro.image} alt={pro.name} className="w-full h-full object-cover" />
                      ) : (
                        <User className="w-6 h-6 text-brand-muted" />
                      )}
                    </div>
                    <div>
                      <h3 className="font-bold text-brand-text text-base leading-tight">
                        {pro.name}
                      </h3>
                      {pro.nutritionistProfile?.specialization && (
                        <p className="text-xs text-brand-muted mt-0.5">
                          {pro.nutritionistProfile.specialization}
                        </p>
                      )}
                    </div>
                  </div>
                  <Badge variant="verified" className="text-[10px]">
                    Verified RND
                  </Badge>
                </div>

                {pro.nutritionistProfile?.bio && (
                  <p className="text-xs text-brand-muted line-clamp-3 mb-4 leading-relaxed text-left">
                    {pro.nutritionistProfile.bio}
                  </p>
                )}

                <div className="grid grid-cols-2 gap-2 mb-4 text-left">
                  <div className="bg-brand-surface/40 p-2 border border-brand-border/40 rounded-lg">
                    <span className="block text-[10px] text-brand-muted uppercase font-bold tracking-wider mb-1">
                      Experience
                    </span>
                    <span className="text-sm font-bold text-brand-text">
                      {pro.nutritionistProfile?.yearsOfExperience ? `${pro.nutritionistProfile.yearsOfExperience} yrs` : 'N/A'}
                    </span>
                  </div>
                  <div className="bg-brand-surface/40 p-2 border border-brand-border/40 rounded-lg">
                    <span className="block text-[10px] text-brand-muted uppercase font-bold tracking-wider mb-1">
                      Rating
                    </span>
                    <span className="text-sm font-bold text-brand-green flex items-center gap-1">
                      <Star className="w-3.5 h-3.5 fill-brand-green stroke-brand-green" />
                      <span>{pro.nutritionistProfile?.rating ? pro.nutritionistProfile.rating.toFixed(1) : 'New'}</span>
                    </span>
                  </div>
                  <div className="bg-brand-surface/40 p-2 border border-brand-border/40 rounded-lg col-span-2">
                    <span className="block text-[10px] text-brand-muted uppercase font-bold tracking-wider mb-1">
                      PRC License
                    </span>
                    <span className="text-xs font-semibold text-brand-text">
                      {pro.nutritionistProfile?.prcLicenseNumber || 'Pending'}
                    </span>
                  </div>
                </div>
              </div>

              <Button
                variant="primary"
                onClick={() => handleRequest(pro.id)}
                className="w-full py-2.5 text-xs shadow-lg shadow-brand-green/10"
              >
                Request Consultation
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

