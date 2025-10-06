'use client';

import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { Icon } from 'leaflet';

const projects = [
    { lat: 25.02, lng: -111.41, name: 'Cd Constitución, Baja California Sur', description: 'Sistema de riegos agrícolas' },
    { lat: 27.49, lng: -109.93, name: 'Obregón, Sonora', description: 'EVALUACIÓN DE PROYECTO DE NIVELACIÓN DE TIERRAS AGRÍCOLAS' },
    { lat: 28.16, lng: -105.47, name: 'Meoqui, Chihuahua', description: 'REVESTIMIENTO Y/O ENTUABMIENTO DEL CANAL SUBLATERAL 17+051 Y CANALES RAMALES 2+235 Y 1+532, EN UNA LONGITUD DE 6.4 KM. EN EL MODULO DE RIEGO No.9 EN EL DISTRITO DE RIEGO 005' },
    { lat: 27.93, lng: -105.08, name: 'Saucillo, Chihuahua', description: 'OBRA CIVIL SUBESTACIÓN 115KV Y CCM PARA ESTACIÓN DE BOMBA NIVEL 640 Y 302' },
    { lat: 24.77, lng: -103.35, name: 'San Juan de Guadalupe, Durango', description: 'CONSTRUCCIÓN DE CAMINO DE ACCESO Y DE LA PRESA DE ALMACENAMIENTO Y OBRAS COMPLEMENTARIAS “EL TIGRE”' },
    { lat: 25.54, lng: -103.40, name: 'Torreón, Coahuila de Zaragoza', description: 'REHABILITACIÓN DEL CANAL LATERAL DERECHO 3+500 DEL CANAL PRINCIPAL SACRAMENTO DEL KM 3+400 AL KM 6+620 (TRAMOS ALTERNOS) PERTENECIENTE AL DISTRITO DE RIEGO 017 REGIÓN LAGUNERA' },
    { lat: 25.32, lng: -103.22, name: 'Viesca, Coahuila', description: 'LIMPIEZA DE TERRENO (DESHIERBE CON MEDIOS MECÁNICOS) VILLANUEVA 3 BATCH 1.1 a 1.9 y 2.1 a 2.9 Y DEL BATCH 1 AL 9, MOVIMIENTO DE TIERRAS, BATCH 2, VLL3, CONSTRUCCIÓN DE CAMINOS ACCESO SUR, AMPLIACIÓN Y HABILITACIÓN DE LOS ALMACENES ZONA SUR Y ZONA NORTE, MONTAJE DE VALLADO PERIMETRAL Y RENTA DE MAQUINARIA TODOS ESTOS TRABAJOS EN PLANTA FOTOVOLTAICA VILLANUEVA EN VIESCA, COAHUILA' },
    { lat: 25.79, lng: -100.56, name: 'García, Nuevo León', description: 'CONSTRUCCIÓN DE RELLENO SANITARIO' },
    { lat: 23.65, lng: -103.05, name: 'Sombrerete, Zacatecas', description: 'LIBRAMIENTO A SAN MARTÍN SOMBRERETE ZACATECAS' },
    { lat: 19.34, lng: -103.54, name: 'Atenquique, Jalisco', description: 'CONSTRUCCIÓN DE GASODUCTO DE ACERO AL CARBON API SL X-52 DE 6" DE DIÁMETRO PARA SUMINISTRO DE GAS NATURAL DE LA EMPRESA BIOPAPPEL' },
    { lat: 19.24, lng: -103.61, name: 'Colima, Colima', description: 'CONSTRUCCIÓN DE TERRACERÍAS PARA LA PLATAFORMA, CAMINO DE SERVICIO A LA OBRA (INTERIOR) Y CONSTRUCCIÓN DE DREN PARA EL CONTROL DE ESCURRIMIENTOS, CORRESPONDIENTE A LA PLANTA DE TRATAMIENTO DE AGUAS RESIDUALES UBICADA EN LAS INMDIACIONES DEL POBLADO DE LOS LIMONES Y VILLA DE ÁLVAREZ PERTENECIENTE AL MUNICIPIO DE COLIMA' },
    { lat: 19.70, lng: -101.18, name: 'Morelia, Michoacán', description: 'CONSTRUCCIÓN DE REACTOR DE LODOS ACTIVADOS Y DIGESTOR DE LODOS (TERRACERÍAS)", CORRESPONDIENTE A LA PLANTA DE TRATAMIENTO DE AGUAS RESIDUALES' },
    { lat: 20.35, lng: -101.18, name: 'Valle de Santiago, Guanajuato', description: 'REHABILITACIÓN MEDIANTE EL REVESTIMIENTO CON MAMPOSTERÍA DE 3,318 M.L. DEL CANAL 1ER PADRÓN DEL KM 14+862 AL KM 18+180, DEL DISTRITO DE RIEGO 011 "ALTO RÍO LERMA"' },
    { lat: 22.14, lng: -100.97, name: 'San Luis Potosí, San Luis Potosí', description: 'REHABILITACIÓN Y SOBREELEVACIÓN DE LA PRESA LA TENERÍA DEL PARQUE TANGAMANGA I' },
    { lat: 18.24, lng: -100.67, name: 'C. Altamirano, Guerrero', description: 'CONSTRUCCIÓN DE CANALES DE RIEGO' },
    { lat: 18.50, lng: -88.30, name: 'Chetumal, Quintana Roo', description: 'NIVELACIÓN DE TIERRAS AGRÍCOLAS EN ZONA ARROCERA' },
    { lat: 26.08, lng: -98.30, name: 'Reynosa, Tamaulipas', description: 'CONSTRUCCIÓN DE OBRA DE CONTROL EN EL DREN EL ANHELO CON CRUCE CANAL PRINCIPAL ANZALDÚAS' },
    { lat: 18.77, lng: -95.77, name: 'Ciudad Alvarado, Veracruz', description: 'RECTIFICACIÓN DE DRENES EN EL RÍO PAPALOAPAN' }
];

const customIcon = new Icon({
    iconUrl: '/location-pin.png',
    iconSize: [38, 38],
});

export default function InteractiveMap() {
    return (
        <MapContainer
            center={[23.63, -102.55]}
            zoom={5}
            scrollWheelZoom={false}
            style={{ height: '100%', width: '100%', borderRadius: '8px' }}
        >
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {projects.map((project, index) => (
                <Marker key={index} position={[project.lat, project.lng]} icon={customIcon}>
                    <Popup>
                        <strong>{project.name}</strong><br />{project.description}
                    </Popup>
                </Marker>
            ))}
        </MapContainer>
    );
}