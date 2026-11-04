import { useEffect, useState } from 'react';
import { apiClient, SITE_ID } from '../api';
import type { Issue, IssueStatus, RiskBand } from '../types';

const Dashboard = () => {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [statusFilter, setStatusFilter] = useState<IssueStatus | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);

  useEffect(() => {
    void loadIssues();
  }, [statusFilter]);

  const loadIssues = async () => {
    try {
      setLoading(true);
      setApiError(null);
      const filters =
        statusFilter !== 'all' ? { siteId: SITE_ID, status: statusFilter } : { siteId: SITE_ID };
      const response = await apiClient.listIssues(filters);
      setIssues(response.issues);
    } catch (error) {
      console.error('Failed to load issues:', error);
      setApiError(error instanceof Error ? error.message : 'API unreachable');
    } finally {
      setLoading(false);
    }
  };

  const getRiskColor = (band: RiskBand) => {
    switch (band) {
      case 'critical':
        return 'bg-red-600 text-white';
      case 'high':
        return 'bg-orange-500 text-white';
      case 'medium':
        return 'bg-yellow-500 text-black';
      case 'low':
        return 'bg-green-500 text-white';
      default:
        return 'bg-gray-500 text-white';
    }
  };

  const getStatusColor = (status: IssueStatus) => {
    switch (status) {
      case 'resolved':
        return 'text-green-600';
      case 'reopened':
        return 'text-red-600';
      case 'assigned':
        return 'text-blue-600';
      case 'in-progress':
        return 'text-yellow-600';
      default:
        return 'text-gray-600';
    }
  };

  // Calculate risk score distribution
  const riskDistribution = {
    critical: issues.filter((i) => i.riskBand === 'critical').length,
    high: issues.filter((i) => i.riskBand === 'high').length,
    medium: issues.filter((i) => i.riskBand === 'medium').length,
    low: issues.filter((i) => i.riskBand === 'low').length,
  };

  // Calculate site risk score (weighted average)
  const siteRiskScore =
    issues.length > 0
      ? Math.round(
          issues.reduce((sum, issue) => sum + issue.riskScore, 0) / issues.length
        )
      : 0;

  // 5x5 Heatmap data (Likelihood × Impact)
  const heatmapData = Array.from({ length: 5 }, (_, likelihoodIdx) =>
    Array.from({ length: 5 }, (_, impactIdx) => {
      const likelihood = likelihoodIdx + 1;
      const impact = impactIdx + 1;
      const count = issues.filter(
        (i) => i.likelihood === likelihood && i.impact === impact
      ).length;
      const score = likelihood * impact;
      return { likelihood, impact, count, score };
    })
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Safety Dashboard</h1>

      {/* Summary Cards */}
      {apiError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-8">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-red-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <span className="text-red-800 font-medium">API Unreachable: {apiError}</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm font-medium text-gray-500">Total Issues</div>
          <div className="mt-2 text-3xl font-bold text-gray-900">{issues.length}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm font-medium text-gray-500">Site Risk Score</div>
          <div className="mt-2 text-3xl font-bold text-orange-600">{siteRiskScore}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm font-medium text-gray-500">Open Issues</div>
          <div className="mt-2 text-3xl font-bold text-red-600">
            {issues.filter((i) => i.status !== 'resolved' && i.status !== 'closed').length}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm font-medium text-gray-500">Resolved</div>
          <div className="mt-2 text-3xl font-bold text-green-600">
            {issues.filter((i) => i.status === 'resolved').length}
          </div>
        </div>
      </div>

      {/* Risk Distribution */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Risk Distribution</h2>
        <div className="flex space-x-4">
          <div className="flex-1">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-700">Critical</span>
              <span className="text-sm font-bold text-red-600">{riskDistribution.critical}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-4">
              <div
                className="bg-red-600 h-4 rounded-full"
                style={{
                  width: `${issues.length > 0 ? (riskDistribution.critical / issues.length) * 100 : 0}%`,
                }}
              />
            </div>
          </div>
          <div className="flex-1">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-700">High</span>
              <span className="text-sm font-bold text-orange-600">{riskDistribution.high}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-4">
              <div
                className="bg-orange-500 h-4 rounded-full"
                style={{
                  width: `${issues.length > 0 ? (riskDistribution.high / issues.length) * 100 : 0}%`,
                }}
              />
            </div>
          </div>
          <div className="flex-1">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-700">Medium</span>
              <span className="text-sm font-bold text-yellow-600">{riskDistribution.medium}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-4">
              <div
                className="bg-yellow-500 h-4 rounded-full"
                style={{
                  width: `${issues.length > 0 ? (riskDistribution.medium / issues.length) * 100 : 0}%`,
                }}
              />
            </div>
          </div>
          <div className="flex-1">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-700">Low</span>
              <span className="text-sm font-bold text-green-600">{riskDistribution.low}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-4">
              <div
                className="bg-green-500 h-4 rounded-full"
                style={{
                  width: `${issues.length > 0 ? (riskDistribution.low / issues.length) * 100 : 0}%`,
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 5x5 Risk Heatmap */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">5×5 Risk Heatmap (Likelihood × Impact)</h2>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="border border-gray-300 p-2 bg-gray-100 text-xs">L/I</th>
                {[1, 2, 3, 4, 5].map((impact) => (
                  <th key={impact} className="border border-gray-300 p-2 bg-gray-100 text-xs">
                    Impact {impact}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {heatmapData.reverse().map((row, likelihoodIdx) => (
                <tr key={likelihoodIdx}>
                  <th className="border border-gray-300 p-2 bg-gray-100 text-xs">
                    L {5 - likelihoodIdx}
                  </th>
                  {row.map((cell) => {
                    const intensity =
                      cell.score <= 6
                        ? 'bg-green-200'
                        : cell.score <= 12
                        ? 'bg-yellow-200'
                        : cell.score <= 18
                        ? 'bg-orange-200'
                        : 'bg-red-200';
                    return (
                      <td
                        key={`${cell.likelihood}-${cell.impact}`}
                        className={`border border-gray-300 p-4 text-center ${intensity}`}
                      >
                        <div className="text-2xl font-bold">{cell.count}</div>
                        <div className="text-xs text-gray-600">Score {cell.score}</div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Issue List */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Issues</h2>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as IssueStatus | 'all');
            }}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm"
          >
            <option value="all">All Statuses</option>
            <option value="open">Open</option>
            <option value="assigned">Assigned</option>
            <option value="in-progress">In Progress</option>
            <option value="resolved">Resolved</option>
            <option value="reopened">Reopened</option>
          </select>
        </div>

        {loading ? (
          <div className="text-center py-8 text-gray-500">Loading...</div>
        ) : apiError ? (
          <div className="text-center py-8 text-red-600">
            Unable to load issues. Please check API connection.
          </div>
        ) : issues.length === 0 ? (
          <div className="text-center py-8 text-gray-500">No issues found</div>
        ) : (
          <div className="space-y-4">
            {issues.map((issue) => (
              <div
                key={issue.id}
                className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 cursor-pointer"
                onClick={() => {
                  setSelectedIssue(issue);
                }}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${getRiskColor(
                          issue.riskBand
                        )}`}
                      >
                        {issue.riskBand}
                      </span>
                      <span className={`text-sm font-medium ${getStatusColor(issue.status)}`}>
                        {issue.status}
                      </span>
                    </div>
                    <h3 className="mt-2 text-lg font-semibold text-gray-900">{issue.title}</h3>
                    <div className="mt-1 text-sm text-gray-500">
                      {issue.category} • Zone: {issue.zone}
                      {issue.assignedTo && ` • Assigned to ${issue.assignedTo}`}
                    </div>
                    <div className="mt-1 text-xs text-gray-400">
                      Created: {new Date(issue.createdAt).toLocaleString()}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-gray-900">{issue.riskScore}</div>
                    <div className="text-xs text-gray-500">Risk Score</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Issue Detail Modal */}
      {selectedIssue && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
          onClick={() => {
            setSelectedIssue(null);
          }}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-2xl font-bold text-gray-900">{selectedIssue.title}</h2>
                <button
                  onClick={() => {
                    setSelectedIssue(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <span className="text-sm font-medium text-gray-500">Category:</span>
                  <div className="text-gray-900">{selectedIssue.category}</div>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-500">Status:</span>
                  <div className={getStatusColor(selectedIssue.status)}>{selectedIssue.status}</div>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-500">Risk:</span>
                  <div>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${getRiskColor(
                        selectedIssue.riskBand
                      )}`}
                    >
                      {selectedIssue.riskBand}
                    </span>
                  </div>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-500">Risk Score:</span>
                  <div className="text-2xl font-bold text-gray-900">{selectedIssue.riskScore}</div>
                </div>
              </div>

              {/* Before/After Images */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Evidence</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm font-medium text-gray-500 mb-2">Before</div>
                    {selectedIssue.imageUrl && (
                      <img
                        src={selectedIssue.imageUrl}
                        alt="Before"
                        className="w-full rounded-lg border border-gray-300"
                      />
                    )}
                  </div>
                  {selectedIssue.verificationImages && selectedIssue.verificationImages.length > 0 && (
                    <div>
                      <div className="text-sm font-medium text-gray-500 mb-2">After</div>
                      <img
                        src={selectedIssue.verificationImages[0]}
                        alt="After"
                        className="w-full rounded-lg border border-gray-300"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Audit Trail */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Audit Trail</h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {selectedIssue.auditTrail.map((entry, idx) => (
                    <div key={idx} className="border-l-2 border-blue-500 pl-4 py-2">
                      <div className="text-sm font-medium text-gray-900">{entry.action}</div>
                      <div className="text-xs text-gray-500">
                        {new Date(entry.timestamp).toLocaleString()} • {entry.actor}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
