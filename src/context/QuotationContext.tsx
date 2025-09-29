'use client';

import { createContext, useState, useContext, ReactNode } from 'react';

// Definimos la estructura de un item en la cotización
interface QuotationItem {
    id: string;
    quantity: number;
}

// Definimos lo que nuestro contexto proveerá
interface QuotationContextType {
    items: QuotationItem[];
    addItem: (id: string) => void;
    removeItem: (id: string) => void;
    updateItemQuantity: (id: string, quantity: number) => void;
    clearCart: () => void;
}

// Creamos el contexto con un valor por defecto
const QuotationContext = createContext<QuotationContextType | undefined>(undefined);

// Creamos un "Proveedor" que envolverá nuestra aplicación
export function QuotationProvider({ children }: { children: ReactNode }) {
    const [items, setItems] = useState<QuotationItem[]>([]);

    const addItem = (id: string) => {
        setItems((prevItems) => {
            // Si el item ya existe, no lo duplicamos
            const existingItem = prevItems.find((item) => item.id === id);
            if (existingItem) {
                return prevItems.map((item) =>
                    item.id === id ? { ...item, quantity: item.quantity + 1 } : item
                );
            }
            // Si es nuevo, lo agregamos con cantidad 1
            return [...prevItems, { id, quantity: 1 }];
        });
    };

    const removeItem = (id: string) => {
        setItems((prevItems) => prevItems.filter((item) => item.id !== id));
    };

    const updateItemQuantity = (id: string, quantity: number) => {
        // Si la cantidad es menor a 1 o mayor a 10, no hacemos nada.
        if (quantity < 1 || quantity > 10) return;
        setItems((prevItems) =>
            prevItems.map((item) => item.id === id ? { ...item, quantity } : item)
        );
    };

    const clearCart = () => {
        setItems([]);
    };

    return (
        <QuotationContext.Provider value={{ items, addItem, removeItem, updateItemQuantity, clearCart }}>
            {children}
        </QuotationContext.Provider>
    );
}

// Hook personalizado para usar el contexto fácilmente
export function useQuotation() {
    const context = useContext(QuotationContext);
    if (context === undefined) {
        throw new Error('useQuotation must be used within a QuotationProvider');
    }
    return context;
}