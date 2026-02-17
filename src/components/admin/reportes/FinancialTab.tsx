"use client";

import { Project } from "@/types/project";

interface FinancialTabProps {
  formData: Project;
  setFormData: (data: Project) => void;
}

export default function FinancialTab({
  formData,
  setFormData,
}: FinancialTabProps) {
  const handleFinancialChange = (field: string, value: string | number) => {
    const updatedFinancial = { ...formData.financialProgress, [field]: value };
    
    // Auto-calcular porcentaje si cambia el gasto o presupuesto
    if (field === "spent" || field === "totalBudget") {
      const totalBudget = field === "totalBudget" ? Number(value) : updatedFinancial.totalBudget;
      const spent = field === "spent" ? Number(value) : updatedFinancial.spent;
      
      if (totalBudget > 0) {
        updatedFinancial.percentage = Math.round((spent / totalBudget) * 100);
      }
    }
    
    setFormData({ ...formData, financialProgress: updatedFinancial });
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: currency,
    }).format(amount);
  };

  const available = formData.financialProgress.totalBudget - formData.financialProgress.spent;

  return (
    <div className="space-y-6">
      {/* Currency */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Moneda <span className="text-red-500">*</span>
        </label>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="currency"
              value="MXN"
              checked={formData.financialProgress.currency === "MXN"}
              onChange={(e) => handleFinancialChange("currency", e.target.value)}
              className="w-4 h-4 text-[#e52b2d]"
            />
            <span className="text-sm text-gray-900">MXN (Pesos Mexicanos)</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="currency"
              value="USD"
              checked={formData.financialProgress.currency === "USD"}
              onChange={(e) => handleFinancialChange("currency", e.target.value)}
              className="w-4 h-4 text-[#e52b2d]"
            />
            <span className="text-sm text-gray-900">USD (Dólares)</span>
          </label>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Total Budget */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Presupuesto Total <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
              {formData.financialProgress.currency === "MXN" ? "$" : "US$"}
            </span>
            <input
              type="number"
              value={formData.financialProgress.totalBudget}
              onChange={(e) => handleFinancialChange("totalBudget", parseFloat(e.target.value) || 0)}
              placeholder="15000000"
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#e52b2d] focus:border-transparent text-gray-900"
              step="1000"
              min="0"
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {formatCurrency(formData.financialProgress.totalBudget, formData.financialProgress.currency)}
          </p>
        </div>

        {/* Spent */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Gastado a la Fecha <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
              {formData.financialProgress.currency === "MXN" ? "$" : "US$"}
            </span>
            <input
              type="number"
              value={formData.financialProgress.spent}
              onChange={(e) => handleFinancialChange("spent", parseFloat(e.target.value) || 0)}
              placeholder="9750000"
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#e52b2d] focus:border-transparent text-gray-900"
              step="1000"
              min="0"
              max={formData.financialProgress.totalBudget}
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {formatCurrency(formData.financialProgress.spent, formData.financialProgress.currency)}
          </p>
        </div>
      </div>

      {/* Last Update */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Última Actualización
        </label>
        <input
          type="date"
          value={formData.financialProgress.lastUpdate}
          onChange={(e) => handleFinancialChange("lastUpdate", e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#e52b2d] focus:border-transparent text-gray-900"
        />
      </div>

      {/* Financial Summary Card */}
      <div className="bg-gradient-to-br from-red-50 to-red-100 border border-red-200 rounded-lg p-6">
        <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-[#e52b2d]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Resumen Financiero
        </h4>
        
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-gray-700">Presupuesto Total:</span>
            <span className="font-bold text-lg text-gray-900">
              {formatCurrency(formData.financialProgress.totalBudget, formData.financialProgress.currency)}
            </span>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-gray-700">Gastado:</span>
            <span className="font-bold text-lg text-[#e52b2d]">
              {formatCurrency(formData.financialProgress.spent, formData.financialProgress.currency)}
            </span>
          </div>
          
          <div className="flex justify-between items-center pt-3 border-t border-red-200">
            <span className="text-gray-700">Disponible:</span>
            <span className="font-bold text-lg text-green-600">
              {formatCurrency(available, formData.financialProgress.currency)}
            </span>
          </div>

          {/* Progress Bar */}
          <div className="pt-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-gray-600">Avance Financiero</span>
              <span className="text-2xl font-bold text-[#e52b2d]">
                {formData.financialProgress.percentage}%
              </span>
            </div>
            <div className="bg-gray-200 rounded-full h-4 overflow-hidden">
              <div
                className="bg-gradient-to-r from-[#e52b2d] to-[#c91f21] h-full transition-all duration-300 flex items-center justify-center"
                style={{ width: `${formData.financialProgress.percentage}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Warning if overspent */}
      {formData.financialProgress.spent > formData.financialProgress.totalBudget && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <svg className="w-6 h-6 text-red-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <h4 className="font-semibold text-red-900 mb-1">
                Presupuesto Excedido
              </h4>
              <p className="text-sm text-red-700">
                El gasto actual excede el presupuesto total por{" "}
                {formatCurrency(
                  formData.financialProgress.spent - formData.financialProgress.totalBudget,
                  formData.financialProgress.currency
                )}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
