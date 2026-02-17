'use client';

import { Metadata } from 'next';
import { useState } from 'react';
import ContactForm from '@/components/contactForm';

// Array con los datos del directorio para mantener el código limpio
const directoryContacts = [
    {
        department: 'Ventas',
        phone: '871 754 1464',
        email: 'ventas@coconsa.com.mx',
    },
    {
        department: 'Recursos Humanos',
        phone: '871 100 5393',
        email: 'recursoshumanos@coconsa.com.mx',
    },
    {
        department: 'Contabilidad',
        phone: '871 236 3972',
        email: 'finanzas@coconsa.com.mx',
    },
    {
        department: 'Maquinaria',
        phone: '871 239 8974',
        email: 'maquinaria@coconsa.com.mx',
    },
    {
        department: 'Construcción',
        phone: '871 506 3866',
        email: 'jose.velazquez@coconsa.com.mx',
    }
];

export default function ContactoPage() {
    const [formData, setFormData] = useState({ name: '', email: '', phone: '', message: '' });
    const [formStatus, setFormStatus] = useState('idle'); // 'idle', 'submitting', 'success', 'error'

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setFormStatus('submitting');
        setTimeout(() => {
            setFormStatus('success');
            setFormData({ name: '', email: '', phone: '', message: '' });
        }, 1000);
    };

    return (
        <main className="bg-white">
            {/* Encabezado */}
            <section className="py-16 sm:py-20 text-center bg-gray-50">
                <div className="container mx-auto px-4">
                    <h1 className="text-4xl md:text-5xl font-bold text-gray-900">
                        Ponte en Contacto con Nosotros
                    </h1>
                    <p className="mt-4 text-lg max-w-3xl mx-auto text-gray-600">
                        Nuestro canal principal está abierto para cualquier consulta. Si necesitas contactar a un área específica, consulta nuestro directorio departamental.
                    </p>
                </div>
            </section>

            {/* Contenido Principal: Mapa y Formulario */}
            <section className="py-16 container mx-auto px-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                    {/* Columna de Información General y Mapa */}
                    <div className="space-y-8">
                        <div>
                            <h2 className="text-3xl font-bold text-gray-800 mb-4">Oficina Central</h2>
                            {/* ... (código de información de contacto principal se queda igual) ... */}
                        </div>
                        <div className="w-full h-96 rounded-lg overflow-hidden shadow-lg">
                            <iframe
                                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3598.818451733215!2d-103.41164622434382!3d25.57788441619623!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x868fd87739762313%3A0xe5457f5c71d5338!2sJoaqu%C3%ADn%20Serrano%20255%2C%20Navarro%2C%2027010%20Torre%C3%B3n%2C%20Coah.!5e0!3m2!1ses-419!2smx!4v1725552393278!5m2!1ses-419!2smx"
                                width="100%" height="100%" style={{ border: 0 }}
                                allowFullScreen={true} loading="lazy" referrerPolicy="no-referrer-when-downgrade"
                            ></iframe>
                        </div>
                    </div>
                    {/* Columna del Formulario */}
                    <ContactForm />
                </div>
            </section>

            {/* NUEVA SECCIÓN: Directorio Departamental */}
            <section className="py-16 bg-white">
                <div className="container mx-auto px-4">
                    <div className="text-center mb-12">
                        <h2 className="text-3xl font-bold text-gray-900">Directorio Departamental</h2>
                        <p className="mt-2 text-lg text-gray-600">Para consultas específicas, contacta directamente al área correspondiente.</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                        {directoryContacts.map((contact) => (
                            <div key={contact.department} className="border border-gray-200 rounded-lg p-6 text-center hover:shadow-xl transition-shadow duration-300">
                                <h3 className="text-xl font-semibold text-red-700">{contact.department}</h3>
                                <div className="mt-4 space-y-3">
                                    <a href={`tel:${contact.phone.replace(/\s/g, '')}`} className="flex items-center justify-center text-gray-700 hover:text-red-700">
                                        <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20"><path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z"></path></svg>
                                        <span>{contact.phone}</span>
                                    </a>
                                    <a href={`mailto:${contact.email}`} className="flex items-center justify-center text-gray-700 hover:text-red-700">
                                        <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20"><path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"></path><path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"></path></svg>
                                        <span className="truncate">{contact.email}</span>
                                    </a>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>
        </main>
    );
}