const { useState, useEffect, useMemo } = React;
// Charts removed for production deployment - using table view only

// Icons
const SearchIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="11" cy="11" r="8"></circle>
    <path d="m21 21-4.35-4.35"></path>
  </svg>
);

const TrendingUpIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline>
    <polyline points="17 6 23 6 23 12"></polyline>
  </svg>
);

const AwardIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="8" r="7"></circle>
    <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"></polyline>
  </svg>
);

const FundAnalyzer = () => {
  const [advisers, setAdvisers] = useState([]);
  const [funds, setFunds] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [activeTab, setActiveTab] = useState('advisers');
  const [selectedAdviser, setSelectedAdviser] = useState(null);
  const [timeFilter, setTimeFilter] = useState('All');
  const [loading, setLoading] = useState(true);
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'desc' });
  const [adviserFundsSortConfig, setAdviserFundsSortConfig] = useState({ key: 'Latest_Gross_Asset_Value', direction: 'desc' });

  const SUPABASE_URL = 'https://iihbiatfjufnluwcgarz.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlpaGJpYXRmanVmbmx1d2NnYXJ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk2MzQzMTMsImV4cCI6MjA3NTIxMDMxM30.tuYYgpLrXHReXbu2E1GYmxVnmrX3Wqgz8a5LkutI4mM';

  const supabaseHeaders = {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json'
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  // Parse currency string like "$60,317,287" to number 60317287
  const parseCurrency = (value) => {
    if (!value || value === '') return null;
    if (typeof value === 'number') return value;
    // Remove $, commas, and convert to number
    const parsed = parseFloat(value.toString().replace(/[$,]/g, ''));
    return isNaN(parsed) ? null : parsed;
  };

  const loadInitialData = async () => {
    try {
      setLoading(true);
      console.log('Starting data load from Supabase...');

      // Load advisers
      const advisersRes = await fetch(`${SUPABASE_URL}/rest/v1/Advisers?select=*`, { headers: supabaseHeaders });

      if (!advisersRes.ok) {
        const error = await advisersRes.text();
        throw new Error(`Failed to fetch advisers: ${error}`);
      }

      const advisersData = await advisersRes.json();
      console.log('Advisers loaded:', advisersData.length);

      // Load funds in batches (paginated)
      const BATCH_SIZE = 5000;
      let fundsData = [];
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        console.log(`Loading funds batch ${offset / BATCH_SIZE + 1}...`);
        const fundsRes = await fetch(
          `${SUPABASE_URL}/rest/v1/Funds?select=*&limit=${BATCH_SIZE}&offset=${offset}`,
          { headers: supabaseHeaders }
        );

        if (!fundsRes.ok) {
          const error = await fundsRes.text();
          throw new Error(`Failed to fetch funds: ${error}`);
        }

        const batch = await fundsRes.json();
        fundsData = fundsData.concat(batch);

        hasMore = batch.length === BATCH_SIZE;
        offset += BATCH_SIZE;
      }

      console.log('Total funds loaded:', fundsData.length);

      // Calculate fund totals by CRD
      const fundTotalsByCRD = {};
      const fundYearlyTotalsByCRD = {};
      
      fundsData.forEach(fund => {
        const crd = fund.Adviser_Entity_CRD;
        if (!crd) return;

        if (!fundTotalsByCRD[crd]) {
          fundTotalsByCRD[crd] = 0;
          fundYearlyTotalsByCRD[crd] = {};
        }

        const latestGAV = parseCurrency(fund.Latest_Gross_Asset_Value);
        if (latestGAV) {
          fundTotalsByCRD[crd] += latestGAV;
        }

        const years = ['2011', '2012', '2013', '2014', '2015', '2016', '2017', '2018', '2019', '2020', '2021', '2022', '2023', '2024'];
        years.forEach(year => {
          const gav = parseCurrency(fund[`GAV_${year}`]);
          if (gav) {
            if (!fundYearlyTotalsByCRD[crd][year]) {
              fundYearlyTotalsByCRD[crd][year] = 0;
            }
            fundYearlyTotalsByCRD[crd][year] += gav;
          }
        });
      });

      const enrichedAdvisers = advisersData
        .filter(a => a.Adviser_Name)
        .map(adv => {
          // Parse Total_AUM from string to number
          let totalAUM = parseCurrency(adv.Total_AUM);
          let aumByYear = {};

          // Parse yearly AUM values from adviser data
          const years = ['2011', '2012', '2013', '2014', '2015', '2016', '2017', '2018', '2019', '2020', '2021', '2022', '2023', '2024'];
          years.forEach(year => {
            const adviserYearAUM = parseCurrency(adv[`AUM_${year}`]);
            if (adviserYearAUM) {
              aumByYear[`AUM_${year}`] = adviserYearAUM;
            }
          });

          // If no Total_AUM from adviser table, use sum of fund GAVs
          if (!totalAUM && fundTotalsByCRD[adv.CRD]) {
            totalAUM = fundTotalsByCRD[adv.CRD];

            // If no yearly AUM from adviser, use fund totals
            years.forEach(year => {
              if (!aumByYear[`AUM_${year}`] && fundYearlyTotalsByCRD[adv.CRD]?.[year]) {
                aumByYear[`AUM_${year}`] = fundYearlyTotalsByCRD[adv.CRD][year];
              }
            });
          }

          const aum2022 = aumByYear.AUM_2022;
          const aum2024 = aumByYear.AUM_2024 || totalAUM;

          return {
            ...adv,
            ...aumByYear,
            Total_AUM: totalAUM,  // Keep calculated value, don't default to 0
            calculated_aum_2024: aum2024,
            calculated_aum_2022: aum2022,
            growth_rate_2y: aum2022 && aum2024 && aum2022 > 0
              ? ((aum2024 - aum2022) / aum2022) * 100
              : null
          };
        });

      const enrichedFunds = fundsData
        .filter(f => f.Fund_Name && f.Latest_Gross_Asset_Value)
        .map(fund => {
          const latestGAV = parseCurrency(fund.Latest_Gross_Asset_Value);
          const gav2019 = parseCurrency(fund.GAV_2019);
          const gav2022 = parseCurrency(fund.GAV_2022);
          const gav2023 = parseCurrency(fund.GAV_2023);
          const gav2024 = parseCurrency(fund.GAV_2024);

          return {
            ...fund,
            Latest_Gross_Asset_Value: latestGAV,
            GAV_2019: gav2019,
            GAV_2022: gav2022,
            GAV_2023: gav2023,
            GAV_2024: gav2024,
            growth_1y: gav2023 && gav2024 && gav2023 > 0
              ? ((gav2024 - gav2023) / gav2023) * 100
              : null,
            growth_2y: gav2022 && gav2024 && gav2022 > 0
              ? ((gav2024 - gav2022) / gav2022) * 100
              : null,
            growth_5y: gav2019 && gav2024 && gav2019 > 0
              ? ((gav2024 - gav2019) / gav2019) * 100
              : null
          };
        });

      console.log('Enriched advisers:', enrichedAdvisers.length, 'Enriched funds:', enrichedFunds.length);

      setAdvisers(enrichedAdvisers);
      setFunds(enrichedFunds);
      setLoading(false);

      console.log('Data load complete!');
    } catch (error) {
      console.error('Error loading data:', error);
      console.error('Error stack:', error.stack);
      alert(`Failed to load data: ${error.message}. Check console for details.`);
      setLoading(false);
    }
  };

  useEffect(() => {
    const performSearch = async () => {
      if (!searchTerm || searchTerm.trim().length === 0) {
        setSearchResults([]);
        return;
      }

      setSearching(true);
      try {
        const term = searchTerm.trim();
        
        if (activeTab === 'advisers') {
          const res = await fetch(
            `${SUPABASE_URL}/rest/v1/Advisers?or=(Adviser_Name.ilike.%25${encodeURIComponent(term)}%25,Adviser_Entity_Legal_Name.ilike.%25${encodeURIComponent(term)}%25)&limit=20`,
            { headers: supabaseHeaders }
          );
          
          if (res.ok) {
            const data = await res.json();
            const enriched = data.map(adv => ({
              ...adv,
              growth_rate_2y: adv.AUM_2022 && adv.AUM_2024 && adv.AUM_2022 > 0
                ? ((adv.AUM_2024 - adv.AUM_2022) / adv.AUM_2022) * 100
                : null
            }));
            setSearchResults(enriched);
          }
        } else {
          const res = await fetch(
            `${SUPABASE_URL}/rest/v1/Funds?or=(Fund_Name.ilike.%25${encodeURIComponent(term)}%25,Adviser_Entity_Legal_Name.ilike.%25${encodeURIComponent(term)}%25)&limit=20`,
            { headers: supabaseHeaders }
          );
          
          if (res.ok) {
            const data = await res.json();
            const enriched = data.map(fund => ({
              ...fund,
              growth_1y: fund.GAV_2023 && fund.GAV_2024 && fund.GAV_2023 > 0
                ? ((fund.GAV_2024 - fund.GAV_2023) / fund.GAV_2023) * 100
                : null,
              growth_2y: fund.GAV_2022 && fund.GAV_2024 && fund.GAV_2022 > 0
                ? ((fund.GAV_2024 - fund.GAV_2022) / fund.GAV_2022) * 100
                : null
            }));
            setSearchResults(enriched);
          }
        }
      } catch (error) {
        console.error('Search error:', error);
        setSearchResults([]);
      }
      setSearching(false);
    };

    const debounce = setTimeout(performSearch, 300);
    return () => clearTimeout(debounce);
  }, [searchTerm, activeTab]);

  const rankedAdvisers = useMemo(() => {
    const advisersWithGrowth = advisers.filter(a => a.calculated_aum_2022 && a.calculated_aum_2024 && a.calculated_aum_2022 > 0);
    const sortedBy2024 = [...advisersWithGrowth].sort((a, b) => b.calculated_aum_2024 - a.calculated_aum_2024);
    const sortedBy2022 = [...advisersWithGrowth].sort((a, b) => b.calculated_aum_2022 - a.calculated_aum_2022);

    const rank2022Map = new Map();
    sortedBy2022.forEach((adv, idx) => {
      rank2022Map.set(adv.CRD, idx + 1);
    });

    return sortedBy2024.map((adv, idx) => ({
      ...adv,
      rank_2024: idx + 1,
      rank_2022: rank2022Map.get(adv.CRD),
      rank_change_2y: rank2022Map.get(adv.CRD) - (idx + 1)
    }));
  }, [advisers]);

  const rankedFunds = useMemo(() => {
    return [...funds]
      .filter(f => f.Latest_Gross_Asset_Value)
      .sort((a, b) => b.Latest_Gross_Asset_Value - a.Latest_Gross_Asset_Value)
      .map((fund, idx) => ({
        ...fund,
        rank: idx + 1
      }));
  }, [funds]);

  // Sorting function
  const handleSort = (key) => {
    let direction = 'desc';
    if (sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = 'asc';
    }
    setSortConfig({ key, direction });
  };

  const sortedRankings = useMemo(() => {
    const isAdvisers = activeTab === 'rankings';
    if (!sortConfig.key) return isAdvisers ? rankedAdvisers : rankedFunds;

    const dataToSort = isAdvisers ? [...rankedAdvisers] : [...rankedFunds];

    dataToSort.sort((a, b) => {
      let aVal = a[sortConfig.key];
      let bVal = b[sortConfig.key];

      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      if (sortConfig.direction === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });

    return dataToSort;
  }, [rankedAdvisers, rankedFunds, sortConfig, activeTab]);

  const adviserLeaderboards = useMemo(() => {
    const top10AUM = rankedAdvisers.slice(0, 10);

    // Filter advisers with starting AUM > $10M for growth calculations to avoid inflated percentages
    const validGrowthAdvisers = rankedAdvisers.filter(a =>
      a.growth_rate_2y !== null &&
      a.growth_rate_2y !== undefined &&
      !isNaN(a.growth_rate_2y) &&
      a.calculated_aum_2022 > 10000000  // Exclude funds starting below $10M
    );

    const top10Growth = [...validGrowthAdvisers]
      .sort((a, b) => (b.growth_rate_2y || 0) - (a.growth_rate_2y || 0))
      .slice(0, 10);

    const top10AbsoluteGrowth = [...validGrowthAdvisers]
      .map(a => ({
        ...a,
        absolute_growth_2y: (a.calculated_aum_2024 || 0) - (a.calculated_aum_2022 || 0)
      }))
      .sort((a, b) => b.absolute_growth_2y - a.absolute_growth_2y)
      .slice(0, 10);

    const top10RankChange = [...rankedAdvisers].sort((a, b) => b.rank_change_2y - a.rank_change_2y).slice(0, 10);

    return { top10AUM, top10Growth, top10AbsoluteGrowth, top10RankChange };
  }, [rankedAdvisers]);

  const fundsForAdviser = useMemo(() => {
    if (!selectedAdviser) return [];
    return funds.filter(f => f.Adviser_Entity_CRD === selectedAdviser.CRD);
  }, [funds, selectedAdviser]);

  const sortedAdviserFunds = useMemo(() => {
    if (!adviserFundsSortConfig.key) return fundsForAdviser;

    return [...fundsForAdviser].sort((a, b) => {
      let aVal = a[adviserFundsSortConfig.key];
      let bVal = b[adviserFundsSortConfig.key];

      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      if (adviserFundsSortConfig.direction === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });
  }, [fundsForAdviser, adviserFundsSortConfig]);

  const handleAdviserFundsSort = (key) => {
    let direction = 'desc';
    if (adviserFundsSortConfig.key === key && adviserFundsSortConfig.direction === 'desc') {
      direction = 'asc';
    }
    setAdviserFundsSortConfig({ key, direction });
  };

  const formatCurrency = (value, useShortForm = true) => {
    if (value === null || value === undefined || isNaN(value)) return 'N/A';
    if (value === 0) return '$0';

    if (useShortForm) {
      if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
      if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
      if (value >= 1e3) return `$${(value / 1e3).toFixed(2)}K`;
    }

    // Full format with commas
    return `$${value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  const getChartData = (item, isFund = false) => {
    const years = ['2011', '2012', '2013', '2014', '2015', '2016', '2017', '2018', '2019', '2020', '2021', '2022', '2023', '2024'];
    
    const allData = years
      .map(year => ({
        year,
        value: isFund ? item[`GAV_${year}`] : (item[`AUM_${year}`] || item.Total_AUM)
      }))
      .filter(d => d.value !== null && d.value !== undefined && d.value > 0);

    if (timeFilter === 'All') return allData;
    
    const currentYear = 2024;
    const filterMap = { '6M': 0.5, '1Y': 1, '2Y': 2, '5Y': 5 };
    const yearsBack = filterMap[timeFilter];
    if (!yearsBack) return allData;
    
    const cutoffYear = currentYear - yearsBack;
    return allData.filter(d => parseInt(d.year) >= cutoffYear);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-50">
        <div className="text-xl text-gray-600 mb-4">Loading data from Supabase...</div>
        <div className="text-sm text-gray-500">This may take a moment...</div>
      </div>
    );
  }

  if (advisers.length === 0 && funds.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-50">
        <div className="text-xl font-bold text-red-600 mb-4">No data loaded</div>
        <div className="text-gray-600 mb-2">Advisers: {advisers.length}, Funds: {funds.length}</div>
        <button 
          onClick={loadInitialData}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Retry Loading Data
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="border-b sticky top-0 z-10 bg-white">
        <div className="max-w-7xl mx-auto px-8 py-6">
          <div className="grid grid-cols-3 gap-6 mb-6">
            {/* Leaderboards */}
            <div className="bg-white border rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                  <AwardIcon />
                </div>
                <h3 className="font-semibold text-gray-900">Largest AUM</h3>
              </div>
              <div className="space-y-2">
                {adviserLeaderboards.top10AUM.slice(0, 5).map((adv) => (
                  <div key={adv.CRD} className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 flex-1">
                      <span className="text-sm font-semibold text-gray-900 mt-0.5">{adv.rank_2024}</span>
                      <span className="text-xs text-green-600 font-semibold mt-1">+{adv.rank_change_2y}</span>
                      <span className="text-sm font-medium text-gray-900 break-words">{adv.Adviser_Name}</span>
                    </div>
                    <span className="text-sm font-semibold text-gray-900 whitespace-nowrap">{formatCurrency(adv.Total_AUM, false)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white border rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                  <TrendingUpIcon />
                </div>
                <h3 className="font-semibold text-gray-900">Highest % Growth (2y)</h3>
              </div>
              <div className="space-y-2">
                {adviserLeaderboards.top10Growth.slice(0, 5).map((adv, idx) => (
                  <div key={adv.CRD} className="flex flex-col gap-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2 flex-1">
                        <span className="text-sm font-semibold text-gray-900 mt-0.5">{idx + 1}</span>
                        <span className="text-sm font-medium text-gray-900 break-words">{adv.Adviser_Name}</span>
                      </div>
                      <span className="text-sm font-semibold text-green-600 whitespace-nowrap">+{adv.growth_rate_2y?.toFixed(1)}%</span>
                    </div>
                    <div className="text-xs text-gray-500 ml-6">
                      {formatCurrency(adv.calculated_aum_2022, false)} → {formatCurrency(adv.calculated_aum_2024, false)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white border rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                  <TrendingUpIcon />
                </div>
                <h3 className="font-semibold text-gray-900">Largest $ Growth (2y)</h3>
              </div>
              <div className="space-y-2">
                {adviserLeaderboards.top10AbsoluteGrowth.slice(0, 5).map((adv, idx) => (
                  <div key={adv.CRD} className="flex flex-col gap-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2 flex-1">
                        <span className="text-sm font-semibold text-gray-900 mt-0.5">{idx + 1}</span>
                        <span className="text-sm font-medium text-gray-900 break-words">{adv.Adviser_Name}</span>
                      </div>
                      <span className="text-sm font-semibold text-purple-600 whitespace-nowrap">+{formatCurrency(adv.absolute_growth_2y, false)}</span>
                    </div>
                    <div className="text-xs text-gray-500 ml-6">
                      {formatCurrency(adv.calculated_aum_2022, false)} → {formatCurrency(adv.calculated_aum_2024, false)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex gap-1 border-b">
            <button
              onClick={() => { setActiveTab('advisers'); setSelectedItem(null); setSearchTerm(''); }}
              className={`px-6 py-3 font-medium transition-all ${
                activeTab === 'advisers'
                  ? 'border-b-2 border-gray-900 text-gray-900'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Advisers
            </button>
            <button
              onClick={() => { setActiveTab('funds'); setSelectedItem(null); setSearchTerm(''); }}
              className={`px-6 py-3 font-medium transition-all ${
                activeTab === 'funds'
                  ? 'border-b-2 border-gray-900 text-gray-900'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Funds
            </button>
            <button
              onClick={() => { setActiveTab('rankings'); setSearchTerm(''); setSortConfig({ key: null, direction: 'desc' }); }}
              className={`px-6 py-3 font-medium transition-all ${
                activeTab === 'rankings'
                  ? 'border-b-2 border-gray-900 text-gray-900'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Adviser Rankings
            </button>
            <button
              onClick={() => { setActiveTab('fund-rankings'); setSearchTerm(''); setSortConfig({ key: null, direction: 'desc' }); }}
              className={`px-6 py-3 font-medium transition-all ${
                activeTab === 'fund-rankings'
                  ? 'border-b-2 border-gray-900 text-gray-900'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Fund Rankings
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8 py-8">
        {(activeTab === 'advisers' || activeTab === 'funds') && (
          <div>
            <div className="bg-white rounded-xl border shadow-sm p-6 mb-6">
              <div className="relative">
                <div className="absolute left-4 top-4 text-gray-400">
                  <SearchIcon />
                </div>
                <input
                  type="text"
                  placeholder={activeTab === 'advisers' ? 'Search adviser by name...' : 'Search fund by name...'}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 border-2 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-gray-900 transition-all"
                />
              </div>

              {searchTerm.trim().length > 0 && (
                <div className="mt-4 max-h-80 overflow-y-auto border rounded-lg bg-white">
                  {searching ? (
                    <div className="p-4 text-gray-500 text-center">Searching...</div>
                  ) : searchResults.length > 0 ? (
                    searchResults.map((item, idx) => (
                      <div
                        key={activeTab === 'advisers' ? item.CRD : `${item.Fund_ID}-${idx}`}
                        onClick={() => {
                          if (activeTab === 'advisers') {
                            setSelectedAdviser(item);
                            setSelectedItem(item);
                          } else {
                            setSelectedItem(item);
                          }
                          setSearchTerm('');
                        }}
                        className="p-4 hover:bg-gray-50 cursor-pointer border-b last:border-0 transition-colors"
                      >
                        <div className="font-semibold text-gray-900">
                          {activeTab === 'advisers' ? item.Adviser_Name : item.Fund_Name}
                          {activeTab === 'advisers' && item.Adviser_Entity_Legal_Name && item.Adviser_Entity_Legal_Name !== item.Adviser_Name && (
                            <span className="text-gray-500 font-normal ml-2">({item.Adviser_Entity_Legal_Name})</span>
                          )}
                        </div>
                        <div className="text-sm text-gray-600 mt-1">
                          {activeTab === 'advisers' 
                            ? `AUM: ${formatCurrency(item.Total_AUM)}${item.growth_rate_2y !== null ? ` • Growth: ${item.growth_rate_2y >= 0 ? '+' : ''}${item.growth_rate_2y.toFixed(1)}%` : ''}`
                            : `GAV: ${formatCurrency(item.Latest_Gross_Asset_Value)} • Adviser: ${item.Adviser_Entity_Legal_Name}`
                          }
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 text-gray-500 text-center">No results found</div>
                  )}
                </div>
              )}
            </div>

            {selectedItem && (
              <div className="bg-white rounded-xl border shadow-sm p-8">
                <div className="mb-8">
                  <h2 className="text-3xl font-bold text-gray-900 mb-6">
                    {activeTab === 'advisers' ? selectedItem.Adviser_Name : selectedItem.Fund_Name}
                  </h2>
                  <div className="grid grid-cols-4 gap-6">
                    <div>
                      <div className="text-sm text-gray-500 mb-1">{activeTab === 'advisers' ? 'Current AUM' : 'Current GAV'}</div>
                      <div className="text-2xl font-bold text-gray-900">
                        {formatCurrency(activeTab === 'advisers' ? selectedItem.calculated_aum_2024 || selectedItem.Total_AUM : selectedItem.Latest_Gross_Asset_Value)}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500 mb-1">2-Year Growth</div>
                      <div className={`text-2xl font-bold ${(activeTab === 'advisers' ? selectedItem.growth_rate_2y : selectedItem.growth_2y) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {activeTab === 'advisers'
                          ? selectedItem.growth_rate_2y ? `${selectedItem.growth_rate_2y >= 0 ? '+' : ''}${selectedItem.growth_rate_2y.toFixed(1)}%` : 'N/A'
                          : selectedItem.growth_2y ? `${selectedItem.growth_2y >= 0 ? '+' : ''}${selectedItem.growth_2y.toFixed(1)}%` : 'N/A'
                        }
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500 mb-1">{activeTab === 'advisers' ? 'Type' : 'Adviser'}</div>
                      <div className="text-2xl font-bold text-gray-900 truncate">
                        {activeTab === 'advisers' ? (selectedItem.Type || 'N/A') : (selectedItem.Adviser_Entity_Legal_Name || 'N/A')}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500 mb-1">{activeTab === 'advisers' ? 'CRD' : 'Fund ID'}</div>
                      <div className="text-2xl font-bold text-gray-900">{activeTab === 'advisers' ? selectedItem.CRD : selectedItem.Fund_ID}</div>
                    </div>
                  </div>
                </div>

                {activeTab === 'advisers' && (
                  <div className="flex justify-end gap-2 mb-4">
                    {['6M', '1Y', '2Y', '5Y', 'All'].map(period => (
                      <button
                        key={period}
                        onClick={() => setTimeFilter(period)}
                        className={`px-4 py-2 rounded-lg font-medium transition-all ${
                          timeFilter === period ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {period}
                      </button>
                    ))}
                  </div>
                )}

                <div className="bg-gray-50 rounded-lg p-6">
                  <h4 className="text-sm font-semibold text-gray-700 mb-4">Historical Data</h4>
                  <div className="space-y-3">
                    {(() => {
                      const chartData = getChartData(selectedItem, activeTab === 'funds');
                      const maxValue = Math.max(...chartData.map(d => d.value));
                      return chartData.map((item, idx) => (
                        <div key={idx}>
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-sm font-medium text-gray-600">{item.year}</span>
                            <span className="text-sm font-bold text-emerald-600">{formatCurrency(item.value)}</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-emerald-500 h-2 rounded-full transition-all"
                              style={{ width: `${(item.value / maxValue) * 100}%` }}
                            ></div>
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                </div>

                {activeTab === 'advisers' && selectedAdviser && fundsForAdviser.length > 0 && (
                  <div className="mt-8">
                    <h3 className="text-xl font-bold text-gray-900 mb-4">Funds Managed ({fundsForAdviser.length})</h3>
                    <button
                      onClick={() => { setActiveTab('funds'); setSelectedItem(null); }}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      View All Funds for This Adviser
                    </button>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'funds' && selectedAdviser && !selectedItem && (
              <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                <div className="p-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-4">Funds for {selectedAdviser.Adviser_Name} ({fundsForAdviser.length})</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Fund Name</th>
                        <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Current GAV</th>
                        <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">1Y Growth</th>
                        <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">2Y Growth</th>
                        <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">5Y Growth</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {fundsForAdviser.map((fund, idx) => (
                        <tr 
                          key={`${fund.Fund_ID}-${idx}`}
                          className="hover:bg-gray-50 transition-colors cursor-pointer"
                          onClick={() => setSelectedItem(fund)}
                        >
                          <td className="px-6 py-4 text-sm text-gray-900 font-medium">{fund.Fund_Name}</td>
                          <td className="px-6 py-4 text-sm text-right font-semibold text-gray-900">{formatCurrency(fund.Latest_Gross_Asset_Value)}</td>
                          <td className={`px-6 py-4 text-sm text-right font-semibold ${fund.growth_1y >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {fund.growth_1y ? `${fund.growth_1y >= 0 ? '+' : ''}${fund.growth_1y.toFixed(1)}%` : 'N/A'}
                          </td>
                          <td className={`px-6 py-4 text-sm text-right font-semibold ${fund.growth_2y >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {fund.growth_2y ? `${fund.growth_2y >= 0 ? '+' : ''}${fund.growth_2y.toFixed(1)}%` : 'N/A'}
                          </td>
                          <td className={`px-6 py-4 text-sm text-right font-semibold ${fund.growth_5y >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {fund.growth_5y ? `${fund.growth_5y >= 0 ? '+' : ''}${fund.growth_5y.toFixed(1)}%` : 'N/A'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'rankings' && (
          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Rank</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Fund Manager</th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Total AUM</th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Growth Rate (2y)</th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Rank Change</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {rankedAdvisers.slice(0, 100).map((adv, idx) => (
                    <tr 
                      key={adv.CRD} 
                      className="hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => { setSelectedItem(adv); setSelectedAdviser(adv); setActiveTab('advisers'); }}
                    >
                      <td className="px-6 py-4 text-sm font-semibold text-gray-900">{idx + 1}</td>
                      <td className="px-6 py-4 text-sm text-gray-900 font-medium">{adv.Adviser_Name}</td>
                      <td className="px-6 py-4 text-sm text-right font-semibold text-gray-900">{formatCurrency(adv.Total_AUM)}</td>
                      <td className={`px-6 py-4 text-sm text-right font-semibold ${adv.growth_rate_2y >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {adv.growth_rate_2y ? `${adv.growth_rate_2y >= 0 ? '+' : ''}${adv.growth_rate_2y.toFixed(1)}%` : 'N/A'}
                      </td>
                      <td className={`px-6 py-4 text-sm text-right font-semibold ${adv.rank_change_2y > 0 ? 'text-green-600' : adv.rank_change_2y < 0 ? 'text-red-600' : 'text-gray-600'}`}>
                        {adv.rank_change_2y > 0 ? `↑ ${adv.rank_change_2y}` : adv.rank_change_2y < 0 ? `↓ ${Math.abs(adv.rank_change_2y)}` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

ReactDOM.render(<FundAnalyzer />, document.getElementById('root'));
