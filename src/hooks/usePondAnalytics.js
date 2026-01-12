import { useMemo } from 'react';

export const usePondAnalytics = (historyData = []) => {
  return useMemo(() => {
    if (!historyData || historyData.length === 0) {
      return {
        summary: { totalHarvests: 0, totalRevenue: 0, totalWeight: 0, avgWeight: 0, avgSurvival: 0 },
        charts: { labels: [], revenue: [], weight: [], survival: [] },
        csvData: []
      };
    }

    // Sort by date ascending for charts (Oldest -> Newest)
    const sortedData = [...historyData].sort((a, b) => new Date(a.harvest_date) - new Date(b.harvest_date));

    let totalRevenue = 0;
    let totalWeight = 0;
    let totalSurvival = 0;
    let survivalCount = 0;

    const chartLabels = [];
    const chartRevenue = [];
    const chartWeight = [];
    const chartSurvival = [];
    
    // Prepare CSV rows
    const csvRows = sortedData.map(item => {
      // 1. Calculations per item
      const revenue = item.revenue || 0;
      const weight = item.total_weight_kg || 0;
      const stocked = item.quantity_stocked || 0;
      const harvested = item.quantity_harvested || 0;
      
      let survival = 0;
      if (stocked > 0) {
        survival = (harvested / stocked) * 100;
        totalSurvival += survival;
        survivalCount++;
      }

      let duration = 0;
      if (item.stocking_date && item.harvest_date) {
        const start = new Date(item.stocking_date);
        const end = new Date(item.harvest_date);
        duration = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
      }

      const avgFishWeight = harvested > 0 ? (weight / harvested).toFixed(2) : 0;

      // 2. Aggregate Totals
      totalRevenue += revenue;
      totalWeight += weight;

      // 3. Prepare Chart Data (Format date as MM/YY for labels)
      const dateLabel = new Date(item.harvest_date).toLocaleDateString('en-US', { month: 'numeric', year: '2-digit' });
      chartLabels.push(dateLabel);
      chartRevenue.push(revenue);
      chartWeight.push(weight);
      chartSurvival.push(parseFloat(survival.toFixed(1)));

      // 4. Prepare Export Object
      return {
        harvest_date: item.harvest_date,
        fry_type: item.fry_type,
        fish_size: item.fish_size || 'N/A',
        quantity_stocked: stocked,
        quantity_harvested: harvested,
        total_weight_kg: weight,
        revenue: revenue,
        survival_rate: survival.toFixed(2) + '%',
        cycle_duration_days: duration,
        avg_weight_per_fish: avgFishWeight
      };
    });

    return {
      summary: {
        totalHarvests: historyData.length,
        totalRevenue,
        totalWeight,
        avgWeight: (totalWeight / historyData.length).toFixed(1), // Avg harvest weight
        avgSurvival: survivalCount > 0 ? (totalSurvival / survivalCount).toFixed(1) : 0
      },
      charts: {
        labels: chartLabels, // X-Axis
        revenue: chartRevenue,
        weight: chartWeight,
        survival: chartSurvival
      },
      csvData: csvRows
    };
  }, [historyData]);
};