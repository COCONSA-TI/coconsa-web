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
    { lat: 18.77, lng: -95.77, name: 'Ciudad Alvarado, Veracruz', description: 'RECTIFICACIÓN DE DRENES EN EL RÍO PAPALOAPAN' },
    {
        "lat": 31.7397,
        "lng": -106.4869,
        "name": "Cd Juarez, Chihuahua",
        "description": "parque fotovoltaico limpieza de terreno y nivelacion de 600 hectareas"
    },
    {
        "lat": 29.3232,
        "lng": -100.9522,
        "name": "Acuña, Coahuila",
        "description": ""
    },
    {
        "lat": 28.7093,
        "lng": -100.5236,
        "name": "Piedras Negras, Coahuila",
        "description": ""
    },
    {
        "lat": 25.4232,
        "lng": -101.0000,
        "name": "Saltillo, Coahuila",
        "description": ""
    },
    {
        "lat": 27.0280,
        "lng": -103.3655,
        "name": "Quimicas del Rey, Coahuila",
        "description": ""
    },
    {
        "lat": 28.0431,
        "lng": -103.7911,
        "name": "Hercules, Coahuila",
        "description": ""
    },
    {
        "lat": 26.9103,
        "lng": -101.4222,
        "name": "Monclova, Coahuila",
        "description": ""
    },
    {
        "lat": 27.0625,
        "lng": -101.5467,
        "name": "San Buenaventura, Coahuila",
        "description": ""
    },
    {
        "lat": 27.2350,
        "lng": -101.4122,
        "name": "Escobedo, Coahuila",
        "description": ""
    },
    {
        "lat": 27.6000,
        "lng": -100.7333,
        "name": "Juarez, Coahuila",
        "description": ""
    },
    {
        "lat": 27.4289,
        "lng": -100.9872,
        "name": "Progreso, Coahuila",
        "description": ""
    },
    {
        "lat": 25.5778,
        "lng": -103.4983,
        "name": "Gomez Palacio, Durango",
        "description": ""
    },
    {
        "lat": 25.5447,
        "lng": -103.5263,
        "name": "Lerdo, Durango",
        "description": ""
    },
    {
        "lat": 24.0167,
        "lng": -104.6667,
        "name": "Durango, Durango",
        "description": ""
    },
    {
        "lat": 26.1083,
        "lng": -103.4431,
        "name": "Tlahualilo, Durango",
        "description": ""
    },
    {
        "lat": 23.2167,
        "lng": -106.4167,
        "name": "Mazatlan, Sinaloa",
        "description": ""
    },
    {
        "lat": 24.8000,
        "lng": -107.3833,
        "name": "Culiacan, Sinaloa",
        "description": ""
    },
    {
        "lat": 23.1667,
        "lng": -102.8667,
        "name": "Fresnillo, Zacatecas",
        "description": ""
    },
    {
        "lat": 22.7800,
        "lng": -102.5700,
        "name": "Zacatecas, Zacatecas",
        "description": ""
    },
    {
        "lat": 27.4779,
        "lng": -99.5496,
        "name": "Nuevo Laredo, Tamaulipas",
        "description": ""
    },
    {
        "lat": 21.8853,
        "lng": -102.2916,
        "name": "Aguascalientes, Aguascalientes",
        "description": ""
    },
    {
        "lat": 19.5306,
        "lng": -103.4462,
        "name": "Atenquique, Jalisco",
        "description": ""
    },
    {
        "lat": 21.1228,
        "lng": -101.6833,
        "name": "Leon, Guanajuato",
        "description": ""
    },
    {
        "lat": 21.0000,
        "lng": -100.3833,
        "name": "San Jose de Iturbide, Guanajuato",
        "description": ""
    },
    {
        "lat": 20.4831,
        "lng": -99.2171,
        "name": "Ixmiquilpan, Hidalgo",
        "description": ""
    },
    {
        "lat": 21.1333,
        "lng": -98.4167,
        "name": "Huejutla, Hidalgo",
        "description": ""
    },
    {
        "lat": 17.5500,
        "lng": -99.5000,
        "name": "Chilpancingo, Guerrero",
        "description": ""
    },
    {
        "lat": 19.7000,
        "lng": -101.1800,
        "name": "Morelia, Michoacan",
        "description": ""
    },
    {
        "lat": 18.5263,
        "lng": -88.2833,
        "name": "Chetumal, Quintana Roo",
        "description": ""
    }
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