import React, { useState, useMemo, useId, useEffect } from "react";
import {
  Search, ShoppingCart, Plus, Minus, X, Package, Wrench, Hammer,
  Boxes, Construction, Check, Trophy,
  User, LogOut, AlertCircle
} from "lucide-react";

// =========================================================
//  Conexión con el backend (araujo-bot/api/catalogo)
// =========================================================
const BACKEND_URL = "https://araujo-bot.onrender.com/api/catalogo";

// Estos arrays los rellena el backend al cargar.
// Si el backend tarda o falla, se usan los datos semilla (declarados más abajo).
let OBRAS = [];
let OPERARIOS = [];
let CATALOGO = [];

// Bandera global del estado de carga (la lee App() para mostrar loading)
let datosCargados = false;
let errorBackend = null;

async function cargarDatosBackend() {
  try {
    const r = await fetch(BACKEND_URL + "/public");
    if (!r.ok) throw new Error("HTTP " + r.status);
    const data = await r.json();
    CATALOGO = Array.isArray(data.productos) ? data.productos : CATALOGO_SEED;
    OBRAS = Array.isArray(data.obras) ? data.obras : OBRAS_SEED;
    OPERARIOS = Array.isArray(data.operarios) ? data.operarios.map(o => o.nombre || o) : OPERARIOS_SEED;
    // Asegurar que la opción "Otro" esté al final
    if (!OPERARIOS.includes("Otro (escribir nombre)")) {
      OPERARIOS = [...OPERARIOS, "Otro (escribir nombre)"];
    }
    datosCargados = true;
    errorBackend = null;
    console.log("[ARA] Datos cargados desde backend:", CATALOGO.length, "productos,", OBRAS.length, "obras,", OPERARIOS.length, "operarios");
  } catch (e) {
    console.warn("[ARA] No se pudo cargar del backend, usando datos locales:", e.message);
    CATALOGO = CATALOGO_SEED;
    OBRAS = OBRAS_SEED;
    OPERARIOS = OPERARIOS_SEED;
    datosCargados = true;
    errorBackend = e.message;
  }
}

// =========================================================
//  ARA CORPORATE — App de pedidos de obra
//  Catálogo unificado con comparativa de proveedores:
//    🟢 AQUATUBO SL  vs  🟡 ARAMBURU GUZMÁN SLU
//
//  Datos extraídos de:
//   · 41 facturas de Aquatubo (oct/2025 – abr/2026)
//   · 50 facturas de Aramburu Guzmán (dic/2025 – abr/2026)
//
//  Precio NETO = bruto × (1 − dto/100), tal como aparece en factura
// =========================================================

// --- Obras activas detectadas en facturas -----------------
const OBRAS_SEED = [
  { id: "JP17",   nombre: "Juan Pablos Edif. 17",          dir: "Calle Juan Pablos 17, Sevilla" },
  { id: "DF20",   nombre: "Doña Francisquita 20",          dir: "Calle Doña Francisquita 20, Sevilla" },
  { id: "OL67",   nombre: "Ntra. Sra. Oliva 67",           dir: "Bda. Nuestra Señora de la Oliva 67, Sevilla" },
  { id: "OLE2",   nombre: "Ntra. Sra. Oliva Edif. 2",      dir: "Bda. Nuestra Señora de la Oliva Edif. 2, Sevilla" },
  { id: "OL94",   nombre: "C/ Virgen de la Oliva 94",      dir: "C/ Virgen de la Oliva 94, Sevilla" },
  { id: "RT9",    nombre: "Rodrigo de Triana 9",           dir: "Rodrigo de Triana 9, Sevilla" },
  { id: "GO21",   nombre: "Calle Goya 21",                 dir: "Calle Goya 21, Sevilla" },
  { id: "DF39",   nombre: "Doctor Fedriani 39",            dir: "Doctor Fedriani 39, Sevilla" },
  { id: "PD1",    nombre: "Plaza Duendes 1",               dir: "Plaza Duendes 1, Sevilla" },
  { id: "PG13",   nombre: "Plaza Generalife 13",           dir: "Plaza Generalife 13, Sevilla" },
  { id: "RS9",    nombre: "Regimiento de Soria 9",         dir: "Regimiento de Soria 9, Sevilla" },
  { id: "AT1",    nombre: "Astronomía Torre 1",            dir: "Calle Astronomía Torre 1, Sevilla" },
  { id: "AG7",    nombre: "C/ Ágata Edif. 7",              dir: "C/ Ágata Edif. 7, Sevilla" },
  { id: "VV18",   nombre: "Virgen del Valle 18",           dir: "Calle Virgen del Valle 18, Sevilla" },
  { id: "BT20",   nombre: "Calle Betis 20",                dir: "Calle Betis 20, Sevilla" },
];

// --- Operarios (lista demo, en producción vendría de BBDD) ---
const OPERARIOS_SEED = [
  "Antonio Ramírez Romero",
  "Miguel Ángel Espada Pérez",
  "Miguel Ángel Espada Rebollo",
  "Juan García",
  "Pedro Fernández",
  "Manuel López",
  "Otro (escribir nombre)"
];

// --- CATÁLOGO UNIFICADO -----------------------------------
// Cada producto puede tener precio en uno o ambos proveedores.
// proveedores: { aqua: {bruto, dto, ref}, aram: {bruto, dto, ref} }
const CATALOGO_SEED = [
  // === MULTICAPA — alta coincidencia ===
  {
    id: "mc-tubo-25", desc: "Tubería multicapa PEX/AL/PE Ø25×2.5mm", familia: "Multicapa",
    unidad: "m", img: "tubo-pex",
    proveedores: {
      aqua: { ref: "25442", bruto: 4.98,  dto: 78.5, marca: "MT" },
      aram: { ref: "MCTBPERT25R", bruto: 3.02, dto: 55, marca: "FE" },
    }
  },
  {
    id: "mc-codo-25", desc: "Codo multicapa 25", familia: "Multicapa",
    unidad: "uni", img: "mcap",
    proveedores: {
      aqua: { ref: "25742", bruto: 10.82, dto: 73, marca: "MT" },
      aram: { ref: "MCCDO25", bruto: 7.45, dto: 50, marca: "FE" },
    }
  },
  {
    id: "mc-codoH-25-34", desc: "Codo multicapa H 25-¾\"", familia: "Multicapa",
    unidad: "uni", img: "mcap",
    proveedores: {
      aqua: { ref: "25750", bruto: 10.13, dto: 74, marca: "MT" },
      aram: { ref: "MCCOT2534", bruto: 7.02, dto: 55, marca: "FE" },
    }
  },
  {
    id: "mc-racor-25-34", desc: "Racor multicapa H 25-¾\"", familia: "Multicapa",
    unidad: "uni", img: "mcap",
    proveedores: {
      aqua: { ref: "25714", bruto: 7.38, dto: 72, marca: "FTSTD" },
      aram: { ref: "MCRFM2534", bruto: 5.06, dto: 50, marca: "FE" },
    }
  },
  {
    id: "mc-te-25", desc: "Te multicapa 25", familia: "Multicapa",
    unidad: "uni", img: "te",
    proveedores: {
      aram: { ref: "MCTEE25255", bruto: 10.91, dto: 50, marca: "FE" },
    }
  },
  {
    id: "mc-manguito-25", desc: "Manguito multicapa 25", familia: "Multicapa",
    unidad: "uni", img: "mcap",
    proveedores: {
      aram: { ref: "MCMAU25", bruto: 5.98, dto: 50, marca: "FE" },
    }
  },
  {
    id: "mc-val-bola-25", desc: "Válvula bola multicapa M/L 25", familia: "Válvulas",
    unidad: "uni", img: "valvula",
    proveedores: {
      aqua: { ref: "39072", bruto: 22.86, dto: 69, marca: "MT" },
      aram: { ref: "VEMC25", bruto: 15.84, dto: 50, marca: "FE" },
    }
  },
  {
    id: "mc-val-empotrar", desc: "Válvula esfera empotrar 25", familia: "Válvulas",
    unidad: "uni", img: "valvula",
    proveedores: {
      aqua: { ref: "25798", bruto: 29.79, dto: 72, marca: "FTSTD" },
    }
  },

  // === VÁLVULAS — alta coincidencia ===
  {
    id: "val-bola-34", desc: "Válvula latón bola M/L acero CRM H-H ¾\" PN25", familia: "Válvulas",
    unidad: "uni", img: "valvula",
    proveedores: {
      aqua: { ref: "17567", bruto: 9.10, dto: 57, marca: "MT" },
      aram: { ref: "3059-05", bruto: 7.66, dto: 50, marca: "—" },
    }
  },
  {
    id: "val-bola-2", desc: "Válvula latón bola M/L acero CRM H-H 2\" PN25", familia: "Válvulas",
    unidad: "uni", img: "valvula",
    proveedores: {
      aqua: { ref: "17575", bruto: 49.56, dto: 61, marca: "MT" },
      aram: { ref: "3028-09", bruto: 33.66, dto: 50, marca: "—" },
    }
  },
  {
    id: "val-bola-25", desc: "Válvula latón bola M/L acero CRM H-H 2½\" PN25", familia: "Válvulas",
    unidad: "uni", img: "valvula",
    proveedores: {
      aqua: { ref: "18773", bruto: 108.41, dto: 61, marca: "MT" },
    }
  },
  {
    id: "val-york-2", desc: "Válvula latón retención York 2\"", familia: "Válvulas",
    unidad: "uni", img: "valvula",
    proveedores: {
      aqua: { ref: "18346", bruto: 44.88, dto: 61, marca: "MT" },
      aram: { ref: "3121-09-2", bruto: 30.63, dto: 50, marca: "—" },
    }
  },
  {
    id: "val-york-25-pn8", desc: "Válvula latón retención York 2½\" PN8", familia: "Válvulas",
    unidad: "uni", img: "valvula",
    proveedores: {
      aqua: { ref: "18347", bruto: 100.76, dto: 57, marca: "MT" },
    }
  },
  {
    id: "val-york-25-pn10", desc: "Válvula latón retención York 2½\" PN10", familia: "Válvulas",
    unidad: "uni", img: "valvula",
    proveedores: {
      aqua: { ref: "22070", bruto: 143.30, dto: 61, marca: "MT" },
      aram: { ref: "3121-10", bruto: 66.65, dto: 50, marca: "—" },
    }
  },
  {
    id: "filtro-2", desc: "Filtro latón inclinado malla H-H 2\"", familia: "Filtros",
    unidad: "uni", img: "filtro",
    proveedores: {
      aqua: { ref: "15038", bruto: 67.39, dto: 61, marca: "MT" },
      aram: { ref: "3302-09", bruto: 47.14, dto: 50, marca: "—" },
    }
  },
  {
    id: "filtro-25", desc: "Filtro latón inclinado malla H-H 2½\"", familia: "Filtros",
    unidad: "uni", img: "filtro",
    proveedores: {
      aqua: { ref: "25173", bruto: 109.89, dto: 61, marca: "GENEB" },
    }
  },

  // === FITTINGS LATÓN ===
  {
    id: "ft-rm-50-15", desc: "Fitting latón enlace rosca macho 50×1½\" r/ext", familia: "Fittings Latón",
    unidad: "uni", img: "fitting",
    proveedores: {
      aqua: { ref: "46673", bruto: 23.64, dto: 67, marca: "MT" },
    }
  },
  {
    id: "ft-rm-63-2", desc: "Fitting latón enlace rosca macho 63×2\" r/ext", familia: "Fittings Latón",
    unidad: "uni", img: "fitting",
    proveedores: {
      aqua: { ref: "46674", bruto: 40.58, dto: 67, marca: "MT" },
      aram: { ref: "5317", bruto: 24.45, dto: 50, marca: "—" },
    }
  },
  {
    id: "ft-codo-50", desc: "Fitting latón codo 90° igual 50 r/ext", familia: "Fittings Latón",
    unidad: "uni", img: "codo",
    proveedores: {
      aqua: { ref: "46652", bruto: 48.64, dto: 67, marca: "MT" },
    }
  },
  {
    id: "ft-codo-63", desc: "Fitting latón codo 90° igual 63 r/ext", familia: "Fittings Latón",
    unidad: "uni", img: "codo",
    proveedores: {
      aqua: { ref: "46653", bruto: 86.43, dto: 67, marca: "MT" },
    }
  },
  {
    id: "ft-rh-50-15", desc: "Fitting latón enlace rosca hembra 50×1½\" r/ext", familia: "Fittings Latón",
    unidad: "uni", img: "fitting",
    proveedores: {
      aram: { ref: "5310", bruto: 17.03, dto: 50, marca: "—" },
    }
  },
  {
    id: "ft-rh-63-2", desc: "Fitting latón enlace rosca hembra 63×2\" r/ext", familia: "Fittings Latón",
    unidad: "uni", img: "fitting",
    proveedores: {
      aqua: { ref: "12183", bruto: 42.08, dto: 57, marca: "MT" },
      aram: { ref: "5311", bruto: 28.87, dto: 50, marca: "—" },
    }
  },
  {
    id: "ft-rh-40-125", desc: "Fitting latón enlace rosca hembra 40×1¼\"", familia: "Fittings Latón",
    unidad: "uni", img: "fitting",
    proveedores: {
      aqua: { ref: "12190", bruto: 17.61, dto: 57, marca: "MT" },
      aram: { ref: "5309", bruto: 10.86, dto: 50, marca: "—" },
    }
  },
  {
    id: "ft-rm-75-25", desc: "Fitting latón enlace rosca macho 75×2½\"", familia: "Fittings Latón",
    unidad: "uni", img: "fitting",
    proveedores: {
      aqua: { ref: "12184", bruto: 101.10, dto: 61, marca: "MT" },
      aram: { ref: "5356", bruto: 47.14, dto: 50, marca: "—" },
    }
  },
  {
    id: "ft-rh-75-25", desc: "Fitting latón enlace rosca hembra 75×2½\"", familia: "Fittings Latón",
    unidad: "uni", img: "fitting",
    proveedores: {
      aqua: { ref: "12194", bruto: 102.45, dto: 61, marca: "MT" },
    }
  },
  {
    id: "ft-mang-63", desc: "Fitting manguito latón 63 r/ext", familia: "Fittings Latón",
    unidad: "uni", img: "fitting",
    proveedores: {
      aram: { ref: "5323", bruto: 21.95, dto: 50, marca: "—" },
    }
  },

  // === ACCESORIOS LATÓN (Te, codo, machón, tapón, reducción) ===
  {
    id: "lt-te-2", desc: "Te latón H 90° 2\"", familia: "Accesorios Latón",
    unidad: "uni", img: "te",
    proveedores: {
      aqua: { ref: "11674", bruto: 33.96, dto: 61, marca: "MT" },
      aram: { ref: "3508", bruto: 27.01, dto: 50, marca: "—" },
    }
  },
  {
    id: "lt-te-25", desc: "Te latón H 90° 2½\"", familia: "Accesorios Latón",
    unidad: "uni", img: "te",
    proveedores: {
      aqua: { ref: "11675", bruto: 90.97, dto: 61, marca: "MT" },
    }
  },
  {
    id: "lt-codo-2", desc: "Codo latón H 90° 2\"", familia: "Accesorios Latón",
    unidad: "uni", img: "codo",
    proveedores: {
      aqua: { ref: "11656", bruto: 26.74, dto: 61, marca: "MT" },
      aram: { ref: "3548", bruto: 16.46, dto: 50, marca: "—" },
    }
  },
  {
    id: "lt-codo-25", desc: "Codo latón H 90° 2½\"", familia: "Accesorios Latón",
    unidad: "uni", img: "codo",
    proveedores: {
      aqua: { ref: "11657", bruto: 64.78, dto: 61, marca: "MT" },
      aram: { ref: "3524", bruto: 39.79, dto: 50, marca: "—" },
    }
  },
  {
    id: "lt-mac-2", desc: "Machón latón 2\"", familia: "Accesorios Latón",
    unidad: "uni", img: "machon",
    proveedores: {
      aqua: { ref: "11699", bruto: 12.22, dto: 61, marca: "MT" },
      aram: { ref: "3009", bruto: 8.67, dto: 50, marca: "—" },
    }
  },
  {
    id: "lt-mac-25", desc: "Machón latón 2½\"", familia: "Accesorios Latón",
    unidad: "uni", img: "machon",
    proveedores: {
      aqua: { ref: "11700", bruto: 36.86, dto: 61, marca: "MT" },
      aram: { ref: "3010", bruto: 12.76, dto: 50, marca: "—" },
    }
  },
  {
    id: "lt-mac-3", desc: "Machón latón 3\"", familia: "Accesorios Latón",
    unidad: "uni", img: "machon",
    proveedores: {
      aram: { ref: "3011", bruto: 21.95, dto: 50, marca: "—" },
    }
  },
  {
    id: "lt-mac-1", desc: "Machón latón 1\"", familia: "Accesorios Latón",
    unidad: "uni", img: "machon",
    proveedores: {
      aram: { ref: "3006", bruto: 2.52, dto: 50, marca: "—" },
    }
  },
  {
    id: "lt-mac-red-25-2", desc: "Machón latón reducido 2½\"×2\"", familia: "Accesorios Latón",
    unidad: "uni", img: "machon",
    proveedores: {
      aram: { ref: "3037", bruto: 13.17, dto: 50, marca: "—" },
    }
  },
  {
    id: "lt-mac-red-2-15", desc: "Machón latón reducido 2\"×1½\"", familia: "Accesorios Latón",
    unidad: "uni", img: "machon",
    proveedores: {
      aram: { ref: "3036", bruto: 8.57, dto: 50, marca: "—" },
    }
  },
  {
    id: "lt-mac-red-15-125", desc: "Machón latón reducido 1½\"×1¼\"", familia: "Accesorios Latón",
    unidad: "uni", img: "machon",
    proveedores: {
      aram: { ref: "3034", bruto: 7.41, dto: 50, marca: "—" },
    }
  },
  {
    id: "lt-tap-2", desc: "Tapón latón M 2\"", familia: "Accesorios Latón",
    unidad: "uni", img: "tapon",
    proveedores: {
      aqua: { ref: "11708", bruto: 12.19, dto: 61, marca: "MT" },
      aram: { ref: "3408", bruto: 6.80, dto: 50, marca: "—" },
    }
  },
  {
    id: "lt-tap-25", desc: "Tapón latón M 2½\"", familia: "Accesorios Latón",
    unidad: "uni", img: "tapon",
    proveedores: {
      aqua: { ref: "11709", bruto: 31.12, dto: 61, marca: "MT" },
    }
  },
  {
    id: "lt-red-3-2", desc: "Reducción latón Hex 3\"×2\"", familia: "Accesorios Latón",
    unidad: "uni", img: "reduccion",
    proveedores: {
      aqua: { ref: "11749", bruto: 52.09, dto: 57, marca: "MT" },
      aram: { ref: "3242", bruto: 16.96, dto: 50, marca: "—" },
    }
  },
  {
    id: "lt-red-3-25", desc: "Reducción latón Hex 3\"×2½\"", familia: "Accesorios Latón",
    unidad: "uni", img: "reduccion",
    proveedores: {
      aqua: { ref: "11750", bruto: 33.88, dto: 61, marca: "MT" },
    }
  },
  {
    id: "lt-red-25-2", desc: "Reducción latón M/H 2½\"×2\"", familia: "Accesorios Latón",
    unidad: "uni", img: "reduccion",
    proveedores: {
      aram: { ref: "3240", bruto: 15.37, dto: 50, marca: "—" },
    }
  },
  {
    id: "lt-red-2-15", desc: "Reducción latón M/H 2\"×1½\"", familia: "Accesorios Latón",
    unidad: "uni", img: "reduccion",
    proveedores: {
      aram: { ref: "3239", bruto: 5.49, dto: 50, marca: "—" },
    }
  },
  {
    id: "lt-red-15-1", desc: "Reducción latón M/H 1½\"×1\"", familia: "Accesorios Latón",
    unidad: "uni", img: "reduccion",
    proveedores: {
      aram: { ref: "3233", bruto: 5.43, dto: 50, marca: "—" },
    }
  },
  {
    id: "lt-red-2-1", desc: "Reducción latón M/H 2\"×1\"", familia: "Accesorios Latón",
    unidad: "uni", img: "reduccion",
    proveedores: {
      aram: { ref: "3237", bruto: 5.49, dto: 50, marca: "—" },
    }
  },
  {
    id: "lt-red-1-34", desc: "Reducción latón H 1\"–M ¾\"", familia: "Accesorios Latón",
    unidad: "uni", img: "reduccion",
    proveedores: {
      aqua: { ref: "11781", bruto: 4.23, dto: 57, marca: "MT" },
    }
  },
  {
    id: "lt-alarg-15-2", desc: "Alargadera latón M/H reducida 1½\"×2\"", familia: "Accesorios Latón",
    unidad: "uni", img: "machon",
    proveedores: {
      aram: { ref: "3212", bruto: 20.72, dto: 50, marca: "—" },
    }
  },
  {
    id: "lt-alarg-34-1", desc: "Alargadera latón M/H reducida ¾\"×1\"", familia: "Accesorios Latón",
    unidad: "uni", img: "machon",
    proveedores: {
      aram: { ref: "3206", bruto: 2.60, dto: 50, marca: "—" },
    }
  },
  {
    id: "lt-alarg-12-34", desc: "Alargadera metal M/H reducida ½\"×¾\" cromo", familia: "Accesorios Latón",
    unidad: "uni", img: "machon",
    proveedores: {
      aram: { ref: "3204C", bruto: 2.40, dto: 50, marca: "—" },
    }
  },

  // === RACORES CONTADOR (exclusivos Aramburu) ===
  {
    id: "rc-50-25", desc: "Racor contador 50 T/loca H 2½\"-M 2\"", familia: "Racores Contador",
    unidad: "uni", img: "fitting",
    proveedores: {
      aram: { ref: "5075", bruto: 50.16, dto: 50, marca: "—" },
    }
  },
  {
    id: "rc-30-15", desc: "Racor contador 30 T/loca H 1½\"-M 1¼\"", familia: "Racores Contador",
    unidad: "uni", img: "fitting",
    proveedores: {
      aram: { ref: "5073", bruto: 18.01, dto: 50, marca: "—" },
    }
  },
  {
    id: "rc-20-1", desc: "Racor contador 20 T/loca H 1\"-M ¾\"", familia: "Racores Contador",
    unidad: "uni", img: "fitting",
    proveedores: {
      aram: { ref: "5071", bruto: 6.11, dto: 50, marca: "—" },
    }
  },

  // === TUBERÍAS PVC EVACUACIÓN ===
  {
    id: "pvc-110", desc: "Tubería PVC evacuación B AENOR 110×3m", familia: "Tuberías",
    unidad: "m", img: "tubo-pvc",
    proveedores: {
      aqua: { ref: "16999", bruto: 8.29, dto: 68.5, marca: "HIDRA" },
    }
  },
  {
    id: "pvc-125", desc: "Tubería PVC evacuación B AENOR 125×3m", familia: "Tuberías",
    unidad: "m", img: "tubo-pvc",
    proveedores: {
      aqua: { ref: "17000", bruto: 8.54, dto: 68.5, marca: "HIDRA" },
    }
  },

  // === PVC accesorios ===
  {
    id: "pvc-te-125", desc: "Te 87° M-H PVC evacuación 125", familia: "PVC Evacuación",
    unidad: "uni", img: "te-pvc",
    proveedores: {
      aqua: { ref: "13286", bruto: 4.26, dto: 50, marca: "MLC" },
    }
  },
  {
    id: "pvc-tedoble-110", desc: "Te 87° doble plana M-H PVC evacuación 110", familia: "PVC Evacuación",
    unidad: "uni", img: "te-pvc",
    proveedores: {
      aqua: { ref: "13302", bruto: 6.48, dto: 48, marca: "CREAR" },
    }
  },
  {
    id: "pvc-codo45-125", desc: "Codo 45° M-H PVC evacuación 125", familia: "PVC Evacuación",
    unidad: "uni", img: "codo-pvc",
    proveedores: {
      aqua: { ref: "13230", bruto: 2.46, dto: 48, marca: "MLC" },
    }
  },
  {
    id: "pvc-codo87-125", desc: "Codo 87° M-H PVC evacuación 125", familia: "PVC Evacuación",
    unidad: "uni", img: "codo-pvc",
    proveedores: {
      aqua: { ref: "13217", bruto: 2.70, dto: 50, marca: "MLC" },
    }
  },
  {
    id: "pvc-red-125-110", desc: "Reducción excéntrica PVC evac 125×110", familia: "PVC Evacuación",
    unidad: "uni", img: "reduc-pvc",
    proveedores: {
      aqua: { ref: "13313", bruto: 3.09, dto: 48, marca: "MLC" },
    }
  },
  {
    id: "pvc-red-125-90", desc: "Reducción excéntrica PVC evac 125×90", familia: "PVC Evacuación",
    unidad: "uni", img: "reduc-pvc",
    proveedores: {
      aqua: { ref: "13312", bruto: 3.16, dto: 48, marca: "CREAR" },
    }
  },
  {
    id: "pvc-deriv-125", desc: "Derivación 45° simple PVC evacuación 125", familia: "PVC Evacuación",
    unidad: "uni", img: "te-pvc",
    proveedores: {
      aram: { ref: "52046", bruto: 4.78, dto: 50, marca: "—" },
    }
  },
  {
    id: "pvc-deriv-doble-125", desc: "Derivación doble 45° PVC 125", familia: "PVC Evacuación",
    unidad: "uni", img: "te-pvc",
    proveedores: {
      aram: { ref: "52231", bruto: 12.38, dto: 50, marca: "—" },
    }
  },
  {
    id: "pvc-red-esp-125-125", desc: "Reducción PVC especial 125-125 larga", familia: "PVC Evacuación",
    unidad: "uni", img: "reduc-pvc",
    proveedores: {
      aram: { ref: "7125125", bruto: 11.96, dto: 50, marca: "—" },
    }
  },
  {
    id: "pvc-red-esp-160-125", desc: "Reducción PVC especial 160-125 larga", familia: "PVC Evacuación",
    unidad: "uni", img: "reduc-pvc",
    proveedores: {
      aram: { ref: "7125160", bruto: 13.77, dto: 50, marca: "—" },
    }
  },
  {
    id: "pvc-red-esp-90-90", desc: "Reducción PVC especial 90-90 larga", familia: "PVC Evacuación",
    unidad: "uni", img: "reduc-pvc",
    proveedores: {
      aram: { ref: "79090", bruto: 8.78, dto: 50, marca: "—" },
    }
  },
  {
    id: "pvc-red-esp-90-85", desc: "Reducción PVC especial 90-85 larga", familia: "PVC Evacuación",
    unidad: "uni", img: "reduc-pvc",
    proveedores: {
      aram: { ref: "79085", bruto: 9.64, dto: 50, marca: "—" },
    }
  },
  {
    id: "caldereta-2020", desc: "Caldereta sifónica 20×20 s/vert 110-90 T-86V", familia: "PVC Evacuación",
    unidad: "uni", img: "filtro",
    proveedores: {
      aqua: { ref: "39508", bruto: 19.06, dto: 37, marca: "TECNO" },
    }
  },

  // === FITTINGS PE100 ===
  {
    id: "pe-fit-rh-40", desc: "Fitting PE enlace rosca hembra 40×1¼\"", familia: "Fittings PE",
    unidad: "uni", img: "fitting-pe",
    proveedores: {
      aqua: { ref: "12099", bruto: 4.04, dto: 57, marca: "HID" },
    }
  },
  {
    id: "pe-fit-rh-50", desc: "Fitting PE enlace rosca hembra 50×1½\"", familia: "Fittings PE",
    unidad: "uni", img: "fitting-pe",
    proveedores: {
      aqua: { ref: "12100", bruto: 4.66, dto: 57, marca: "HID" },
    }
  },
  {
    id: "pe-fit-rh-63", desc: "Fitting PE enlace rosca hembra 63×2\"", familia: "Fittings PE",
    unidad: "uni", img: "fitting-pe",
    proveedores: {
      aqua: { ref: "12101", bruto: 8.09, dto: 57, marca: "HID" },
    }
  },
  {
    id: "pe-fit-codo-40", desc: "Fitting PE codo 90° igual 40", familia: "Fittings PE",
    unidad: "uni", img: "fitting-pe",
    proveedores: {
      aqua: { ref: "11996", bruto: 6.19, dto: 57, marca: "HID" },
    }
  },
  {
    id: "pe-fit-codo-50", desc: "Fitting PE codo 90° igual 50", familia: "Fittings PE",
    unidad: "uni", img: "fitting-pe",
    proveedores: {
      aqua: { ref: "11997", bruto: 8.32, dto: 57, marca: "HID" },
    }
  },
  {
    id: "pe-fit-codo-63", desc: "Fitting PE codo 90° igual 63", familia: "Fittings PE",
    unidad: "uni", img: "fitting-pe",
    proveedores: {
      aqua: { ref: "11998", bruto: 13.31, dto: 57, marca: "HID" },
    }
  },

  // === ELECTROFUSIÓN PE100 ===
  {
    id: "ef-codo-50", desc: "Codo 90° PE100 electrofusión 50 PN16", familia: "Electrofusión",
    unidad: "uni", img: "electro",
    proveedores: {
      aram: { ref: "490504050", bruto: 12.35, dto: 50, marca: "—" },
    }
  },
  {
    id: "ef-codo-63", desc: "Codo 90° PE100 electrofusión 63 PN16", familia: "Electrofusión",
    unidad: "uni", img: "electro",
    proveedores: {
      aqua: { ref: "11891", bruto: 24.41, dto: 59, marca: "AGRU" },
    }
  },
  {
    id: "ef-codo-75", desc: "Codo 90° PE100 electrofusión 75 PN16", familia: "Electrofusión",
    unidad: "uni", img: "electro",
    proveedores: {
      aqua: { ref: "11892", bruto: 31.51, dto: 59, marca: "AGRU" },
      aram: { ref: "490504075", bruto: 22.14, dto: 50, marca: "—" },
    }
  },
  {
    id: "ef-codo-90", desc: "Codo 90° PE100 electrofusión 90 PN16", familia: "Electrofusión",
    unidad: "uni", img: "electro",
    proveedores: {
      aram: { ref: "490504090", bruto: 29.35, dto: 50, marca: "—" },
    }
  },
  {
    id: "ef-codo-iny-63", desc: "Codo 90° PE100 inyectado 63 SDR11", familia: "Electrofusión",
    unidad: "uni", img: "electro",
    proveedores: {
      aqua: { ref: "12361", bruto: 15.29, dto: 59, marca: "AGRU" },
    }
  },
  {
    id: "ef-codo-iny-75", desc: "Codo 90° PE100 inyectado 75 SDR11", familia: "Electrofusión",
    unidad: "uni", img: "electro",
    proveedores: {
      aqua: { ref: "12362", bruto: 18.66, dto: 59, marca: "AGRU" },
    }
  },
  {
    id: "ef-red-75-63", desc: "Reducción PE electrofusión 75×63 PN16", familia: "Electrofusión",
    unidad: "uni", img: "electro",
    proveedores: {
      aram: { ref: "491104075063", bruto: 14.81, dto: 50, marca: "—" },
    }
  },
  {
    id: "ef-red-63-50", desc: "Reducción PE electrofusión 63×50 PN16", familia: "Electrofusión",
    unidad: "uni", img: "electro",
    proveedores: {
      aram: { ref: "491104063050", bruto: 11.10, dto: 50, marca: "—" },
    }
  },
  {
    id: "ef-red-63-40", desc: "Reducción PE electrofusión 63×40 PN16", familia: "Electrofusión",
    unidad: "uni", img: "electro",
    proveedores: {
      aram: { ref: "491104063040", bruto: 11.10, dto: 50, marca: "—" },
    }
  },
  {
    id: "ef-red-50-40", desc: "Reducción PE electrofusión 50×40 PN16", familia: "Electrofusión",
    unidad: "uni", img: "electro",
    proveedores: {
      aram: { ref: "491104050040", bruto: 10.02, dto: 50, marca: "—" },
    }
  },
  {
    id: "ef-mang-90", desc: "Manguito PE electrofusión 90 PN16", familia: "Electrofusión",
    unidad: "uni", img: "electro",
    proveedores: {
      aram: { ref: "490104090", bruto: 8.37, dto: 50, marca: "—" },
    }
  },
  {
    id: "ef-te-90", desc: "Te 90° PE electrofusión 90 PN16", familia: "Electrofusión",
    unidad: "uni", img: "electro",
    proveedores: {
      aram: { ref: "490404090", bruto: 24.38, dto: 50, marca: "—" },
    }
  },
  {
    id: "ef-trans-50", desc: "Transición PE/latón R/H 50×1½\" PN16", familia: "Electrofusión",
    unidad: "uni", img: "electro",
    proveedores: {
      aram: { ref: "493107050015B", bruto: 37.14, dto: 50, marca: "—" },
    }
  },
  {
    id: "ef-trans-90-rm", desc: "Transición PE/latón R/M 90×3\" PN16", familia: "Electrofusión",
    unidad: "uni", img: "electro",
    proveedores: {
      aram: { ref: "492107090030B", bruto: 150.57, dto: 50, marca: "—" },
    }
  },
  {
    id: "ef-trans-90-rh", desc: "Transición PE/latón R/H 90×3\" PN16", familia: "Electrofusión",
    unidad: "uni", img: "electro",
    proveedores: {
      aram: { ref: "493107090030B", bruto: 150.00, dto: 50, marca: "—" },
    }
  },

  // === TUBOS PE100 ===
  {
    id: "tubo-pe-40", desc: "Tubería PE100 AENOR 40-10 atm B6m", familia: "Tuberías",
    unidad: "m", img: "tubo-pe",
    proveedores: {
      aqua: { ref: "27707", bruto: 1.94, dto: 55, marca: "PFERR" },
    }
  },
  {
    id: "tubo-pe-50", desc: "Tubería PE100 AENOR 50-10 atm B6m", familia: "Tuberías",
    unidad: "m", img: "tubo-pe",
    proveedores: {
      aqua: { ref: "16660", bruto: 3.32, dto: 65, marca: "PFERR" },
    }
  },
  {
    id: "tubo-pe-63", desc: "Tubería PE100 63-10 atm B6m", familia: "Tuberías",
    unidad: "m", img: "tubo-pe",
    proveedores: {
      aram: { ref: "63-10AD100B6", bruto: 3.25, dto: 50, marca: "—" },
    }
  },
  {
    id: "tubo-pe-75", desc: "Tubería PE100 AENOR 75-10 atm B6m", familia: "Tuberías",
    unidad: "m", img: "tubo-pe",
    proveedores: {
      aqua: { ref: "16670", bruto: 7.49, dto: 65, marca: "HIDRA" },
    }
  },
  {
    id: "tubo-pe-75-16", desc: "Tubería PE100 AENOR 75-16 atm B6m", familia: "Tuberías",
    unidad: "m", img: "tubo-pe",
    proveedores: {
      aqua: { ref: "16673", bruto: 9.74, dto: 55, marca: "HIDRA" },
    }
  },
  {
    id: "tubo-pe-140", desc: "Tubería PE100 AENOR 140-10 atm B6m", familia: "Tuberías",
    unidad: "m", img: "tubo-pe",
    proveedores: {
      aqua: { ref: "16694", bruto: 23.05, dto: 55, marca: "HIDRA" },
    }
  },

  // === COBRE ===
  {
    id: "cu-mang-22", desc: "Cobre manguito H 22 (270)", familia: "Cobre",
    unidad: "uni", img: "cobre",
    proveedores: {
      aqua: { ref: "10690", bruto: 0.76, dto: 55, marca: "TRADE" },
      aram: { ref: "4049", bruto: 1.98, dto: 50, marca: "—" },
    }
  },
  {
    id: "cu-codo-22", desc: "Cobre codo H 90° 22 (90)", familia: "Cobre",
    unidad: "uni", img: "cobre",
    proveedores: {
      aqua: { ref: "10647", bruto: 1.36, dto: 55, marca: "TRADE" },
      aram: { ref: "4109", bruto: 2.15, dto: 50, marca: "—" },
    }
  },
  {
    id: "cu-codo-22-12", desc: "Cobre codo 90° 22×½\" (GCU)", familia: "Cobre",
    unidad: "uni", img: "cobre",
    proveedores: {
      aram: { ref: "4110", bruto: 4.20, dto: 50, marca: "—" },
    }
  },
  {
    id: "cu-codo-22-34", desc: "Cobre codo 92° 22×¾\" (GCU)", familia: "Cobre",
    unidad: "uni", img: "cobre",
    proveedores: {
      aram: { ref: "4220", bruto: 5.07, dto: 50, marca: "—" },
    }
  },
  {
    id: "cu-mang-243", desc: "Cobre manguito 243 GCU 22×¾\"", familia: "Cobre",
    unidad: "uni", img: "cobre",
    proveedores: {
      aram: { ref: "4014", bruto: 1.89, dto: 50, marca: "—" },
    }
  },
  {
    id: "cu-mang-18-34", desc: "Cobre manguito 270 GCU 18×¾\"", familia: "Cobre",
    unidad: "uni", img: "cobre",
    proveedores: {
      aram: { ref: "4049-18", bruto: 1.98, dto: 50, marca: "—" },
    }
  },
  {
    id: "cu-codo-18-12", desc: "Cobre codo 90° 18×½\"", familia: "Cobre",
    unidad: "uni", img: "cobre",
    proveedores: {
      aram: { ref: "4109-18", bruto: 2.15, dto: 50, marca: "—" },
    }
  },
  {
    id: "cu-tap-35", desc: "Cobre tapón H 35 (301)", familia: "Cobre",
    unidad: "uni", img: "tapon",
    proveedores: {
      aqua: { ref: "10700", bruto: 9.93, dto: 58, marca: "IBP" },
    }
  },
  {
    id: "cu-tap-42", desc: "Cobre tapón H 42 (301)", familia: "Cobre",
    unidad: "uni", img: "tapon",
    proveedores: {
      aqua: { ref: "10701", bruto: 17.53, dto: 55, marca: "IBP" },
    }
  },
  {
    id: "cu-tubo-18", desc: "Tubería cobre duro 18×1mm (B5m)", familia: "Cobre",
    unidad: "m", img: "tubo-pe",
    proveedores: {
      aram: { ref: "2100001200", bruto: 5.24, dto: 0, marca: "—" },
    }
  },
  {
    id: "ent-22-34", desc: "LT-CU entronque M 22×¾\"", familia: "Cobre",
    unidad: "uni", img: "cobre",
    proveedores: {
      aqua: { ref: "25528", bruto: 1.90, dto: 55, marca: "MT" },
    }
  },
  {
    id: "manguito-cu-274-3-4", desc: "Manguito 270 GCU 42×1½\"", familia: "Cobre",
    unidad: "uni", img: "cobre",
    proveedores: {
      aram: { ref: "4056", bruto: 14.68, dto: 50, marca: "—" },
    }
  },

  // === BATERÍAS DE CONTADORES ===
  {
    id: "bat-kit-20", desc: "Kit válvula entrada+salida DN20 batería VH c/manguito", familia: "Baterías",
    unidad: "uni", img: "bateria",
    proveedores: {
      aqua: { ref: "58793", bruto: 38.35, dto: 38, marca: "GTL" },
    }
  },
  {
    id: "bat-kit-kovh", desc: "Kit válvula bat. contador entrada+salida ref. KOVHDN20", familia: "Baterías",
    unidad: "uni", img: "bateria",
    proveedores: {
      aqua: { ref: "27774", bruto: 21.58, dto: 0, marca: "G" },
    }
  },
  {
    id: "bat-emas-ent", desc: "Llave entrada batería bola Emasesa DN20 c/mang 1\"", familia: "Baterías",
    unidad: "uni", img: "bateria",
    proveedores: {
      aram: { ref: "08K102BT20", bruto: 25.20, dto: 50, marca: "—" },
    }
  },
  {
    id: "bat-emas-sal", desc: "Llave salida batería bola Emasesa DN20 c/purga c/mang 1\"", familia: "Baterías",
    unidad: "uni", img: "bateria",
    proveedores: {
      aram: { ref: "08K201BT20", bruto: 23.90, dto: 50, marca: "—" },
    }
  },
  {
    id: "bat-6c", desc: "Batería contadores PPR 6C-2F 2½\"", familia: "Baterías",
    unidad: "uni", img: "bateria",
    proveedores: {
      aqua: { ref: "40253", bruto: 233.29, dto: 38, marca: "GTL" },
    }
  },
  {
    id: "bat-10c", desc: "Batería contadores PPR 10C-2F 2½\" BH", familia: "Baterías",
    unidad: "uni", img: "bateria",
    proveedores: {
      aqua: { ref: "26113", bruto: 243.57, dto: 60, marca: "BH" },
    }
  },
  {
    id: "bat-12c", desc: "Batería contadores PPR 12C-2F 2½\" Ø75", familia: "Baterías",
    unidad: "uni", img: "bateria",
    proveedores: {
      aqua: { ref: "26114", bruto: 259.23, dto: 59.26, marca: "GTL" },
      aram: { ref: "03BPRM122212ST", bruto: 223.35, dto: 50, marca: "—" },
    }
  },
  {
    id: "bat-18c", desc: "Batería contadores PPR 18C-3F 2½\" BH", familia: "Baterías",
    unidad: "uni", img: "bateria",
    proveedores: {
      aqua: { ref: "26120", bruto: 388.20, dto: 61.94, marca: "GTL" },
    }
  },
  {
    id: "bat-20c", desc: "Batería contadores PPR 20C-2F 2½\"", familia: "Baterías",
    unidad: "uni", img: "bateria",
    proveedores: {
      aqua: { ref: "26121", bruto: 327.43, dto: 60.11, marca: "BH" },
    }
  },
  {
    id: "bat-22c", desc: "Batería contadores PPR 22C-2F 2½\" BH", familia: "Baterías",
    unidad: "uni", img: "bateria",
    proveedores: {
      aqua: { ref: "26123", bruto: 339.86, dto: 59.46, marca: "BTS" },
    }
  },
  {
    id: "bat-24c", desc: "Batería contadores PPR 24C-3F 2½\" BH", familia: "Baterías",
    unidad: "uni", img: "bateria",
    proveedores: {
      aqua: { ref: "26125", bruto: 442.88, dto: 62.64, marca: "GTL" },
      aram: { ref: "03BPRM243212ST", bruto: 362.57, dto: 50, marca: "—" },
    }
  },
  {
    id: "bat-puente", desc: "Puente contador 1\" – 115mm", familia: "Baterías",
    unidad: "uni", img: "bateria",
    proveedores: {
      aram: { ref: "04CL100100", bruto: 12.17, dto: 50, marca: "—" },
    }
  },
  {
    id: "bat-conex-1x50", desc: "Conexión blindada M-H 1×50", familia: "Baterías",
    unidad: "uni", img: "bateria",
    proveedores: {
      aram: { ref: "6-M1H1-50", bruto: 17.87, dto: 50, marca: "—" },
    }
  },
  {
    id: "bat-conex-34x40", desc: "Conexión batería M-H ¾×3/4×40", familia: "Baterías",
    unidad: "uni", img: "bateria",
    proveedores: {
      aram: { ref: "6-M34H3-40", bruto: 10.38, dto: 50, marca: "—" },
    }
  },
  {
    id: "bat-brida-ciega", desc: "Brida ciega contador", familia: "Baterías",
    unidad: "uni", img: "bateria",
    proveedores: {
      aram: { ref: "04CIEGA", bruto: 5.60, dto: 50, marca: "—" },
    }
  },
  {
    id: "bat-junta-ancha-1", desc: "Junta goma EPDM ancha 1\"", familia: "Baterías",
    unidad: "uni", img: "tapon",
    proveedores: {
      aram: { ref: "02414", bruto: 0.106, dto: 50, marca: "—" },
    }
  },
  {
    id: "bat-junta-ancha-34", desc: "Junta goma EPDM ancha bat. exc. ¾\"", familia: "Baterías",
    unidad: "uni", img: "tapon",
    proveedores: {
      aram: { ref: "02413", bruto: 0.053, dto: 50, marca: "—" },
    }
  },
  {
    id: "lat-inox-batt", desc: "Latiguillo inox batería M-H ¾-¾×40cm", familia: "Latiguillos",
    unidad: "uni", img: "latiguillo",
    proveedores: {
      aqua: { ref: "24738", bruto: 8.77, dto: 40, marca: "FLEXI" },
    }
  },

  // === AISLAMIENTOS ===
  {
    id: "ais-pe-22", desc: "Aislamiento coquilla PE 9mm Ø22 (2m)", familia: "Aislamientos",
    unidad: "m", img: "aislamiento",
    proveedores: {
      aqua: { ref: "29147", bruto: 0.7452, dto: 58, marca: "ITFLE" },
      aram: { ref: "060222155PE0N0", bruto: 0.571, dto: 50, marca: "—" },
    }
  },
  {
    id: "ais-pe-28", desc: "Aislamiento coquilla PE 9mm Ø28 (2m)", familia: "Aislamientos",
    unidad: "m", img: "aislamiento",
    proveedores: {
      aqua: { ref: "29148", bruto: 0.9936, dto: 58, marca: "ITFLE" },
    }
  },
  {
    id: "ais-elast-25", desc: "Aislamiento coquilla elastomérico 25mm Ø25 (2m)", familia: "Aislamientos",
    unidad: "m", img: "aislamiento",
    proveedores: {
      aqua: { ref: "35221", bruto: 6.20, dto: 58, marca: "ITFLE" },
    }
  },
  {
    id: "ais-elast-6mm", desc: "Aislamiento coquilla elastomérico 6mm Ø25 (2m)", familia: "Aislamientos",
    unidad: "m", img: "aislamiento",
    proveedores: {
      aqua: { ref: "39063", bruto: 1.27, dto: 58, marca: "ITFLE" },
    }
  },

  // === FIJACIONES Y ABRAZADERAS ===
  {
    id: "abz-iso-125", desc: "Abrazadera fijación cincada Ø125 M-8 isofónica", familia: "Fijaciones",
    unidad: "uni", img: "abrazadera",
    proveedores: {
      aqua: { ref: "24327", bruto: 2.72, dto: 57, marca: "MARTI" },
    }
  },
  {
    id: "abz-iso-75", desc: "Abrazadera isofónica M-8/10 75 (75-81)", familia: "Fijaciones",
    unidad: "uni", img: "abrazadera",
    proveedores: {
      aram: { ref: "33435081", bruto: 1.58, dto: 50, marca: "—" },
    }
  },
  {
    id: "abz-nylon-22-25", desc: "Abrazadera nylon gris 22-25", familia: "Fijaciones",
    unidad: "uni", img: "abrazadera",
    proveedores: {
      aram: { ref: "0853622", bruto: 0.215, dto: 50, marca: "—" },
    }
  },
  {
    id: "abz-nylon-26-28", desc: "Abrazadera nylon gris 26-28", familia: "Fijaciones",
    unidad: "uni", img: "abrazadera",
    proveedores: {
      aram: { ref: "0853626", bruto: 0.24, dto: 50, marca: "—" },
    }
  },
  {
    id: "tirafondo-m6-30", desc: "Tirafondo M-6×30", familia: "Fijaciones",
    unidad: "uni", img: "tapon",
    proveedores: {
      aram: { ref: "6356630", bruto: 0.053, dto: 50, marca: "—" },
    }
  },
  {
    id: "tirafondo-m8", desc: "Tirafondo M-8", familia: "Fijaciones",
    unidad: "uni", img: "tapon",
    proveedores: {
      aram: { ref: "6356840", bruto: 0.107, dto: 50, marca: "—" },
    }
  },
  {
    id: "varilla-m6", desc: "Varilla roscada M-6 (L1m)", familia: "Fijaciones",
    unidad: "uni", img: "tapon",
    proveedores: {
      aram: { ref: "6303006", bruto: 1.08, dto: 50, marca: "—" },
    }
  },
  {
    id: "taco-duopower", desc: "Taco Duopower 6×30 (caja 100uds)", familia: "Fijaciones",
    unidad: "uni", img: "tapon",
    proveedores: {
      aram: { ref: "535453", bruto: 0.098, dto: 50, marca: "—" },
    }
  },
  {
    id: "tornigrap-30", desc: "Tornigrap 30", familia: "Fijaciones",
    unidad: "uni", img: "tapon",
    proveedores: {
      aram: { ref: "6174431", bruto: 0.06, dto: 50, marca: "—" },
    }
  },
  {
    id: "perfil-abra-20", desc: "Perfil abrazadera 20mm nylon B2m", familia: "Fijaciones",
    unidad: "m", img: "abrazadera",
    proveedores: {
      aram: { ref: "1333GM2", bruto: 1.96, dto: 50, marca: "—" },
    }
  },
  {
    id: "rapidstrut-2m", desc: "Rapidstrut 2m 41×41/2.5", familia: "Fijaciones",
    unidad: "uni", img: "abrazadera",
    proveedores: {
      aram: { ref: "6505245", bruto: 15.49, dto: 50, marca: "—" },
    }
  },
  {
    id: "mang-separador", desc: "Manguito separador 6×20", familia: "Fijaciones",
    unidad: "uni", img: "tapon",
    proveedores: {
      aram: { ref: "6459620", bruto: 0.20, dto: 50, marca: "—" },
    }
  },
  {
    id: "brida-nylon", desc: "Brida nylon 3,6×290mm negra", familia: "Fijaciones",
    unidad: "uni", img: "tapon",
    proveedores: {
      aram: { ref: "0903290", bruto: 0.075, dto: 50, marca: "—" },
    }
  },

  // === HERRAMIENTAS Y CONSUMIBLES ===
  {
    id: "estano-35", desc: "Estaño tipo plata 3,5% 250g", familia: "Consumibles",
    unidad: "uni", img: "tapon",
    proveedores: {
      aqua: { ref: "10794", bruto: 13.18, dto: 57, marca: "G" },
      aram: { ref: "AG05509", bruto: 21.62, dto: 50, marca: "—" },
    }
  },
  {
    id: "estano-6", desc: "Estaño plata 6% 250g", familia: "Consumibles",
    unidad: "uni", img: "tapon",
    proveedores: {
      aram: { ref: "B02MAC07200N034", bruto: 40.95, dto: 50, marca: "—" },
    }
  },
  {
    id: "decapante", desc: "Decapante pasta c/pincel 125g", familia: "Consumibles",
    unidad: "uni", img: "tapon",
    proveedores: {
      aqua: { ref: "10797", bruto: 9.99, dto: 57, marca: "COLLK" },
      aram: { ref: "22137", bruto: 16.17, dto: 50, marca: "—" },
    }
  },
  {
    id: "castolin-gas", desc: "Castolin botella gas 1450 ONU 2037", familia: "Consumibles",
    unidad: "uni", img: "tapon",
    proveedores: {
      aram: { ref: "73024-0GM", bruto: 9.86, dto: 50, marca: "—" },
    }
  },
  {
    id: "ceys-totaltech", desc: "CEYS Total Tech gris cartucho 290ml", familia: "Consumibles",
    unidad: "uni", img: "tapon",
    proveedores: {
      aram: { ref: "507220", bruto: 11.88, dto: 50, marca: "—" },
    }
  },
  {
    id: "tangit-unilock", desc: "Hilo sellador Tangit Unilock 160m", familia: "Consumibles",
    unidad: "uni", img: "tapon",
    proveedores: {
      aram: { ref: "2959378", bruto: 19.64, dto: 50, marca: "—" },
    }
  },
  {
    id: "lija-150", desc: "Lija metal 230×280 (0GR) - 150", familia: "Consumibles",
    unidad: "uni", img: "tapon",
    proveedores: {
      aram: { ref: "48007", bruto: 1.88, dto: 50, marca: "—" },
    }
  },
  {
    id: "lija-100", desc: "Lija metal 230×280 (1GR) - 100", familia: "Consumibles",
    unidad: "uni", img: "tapon",
    proveedores: {
      aram: { ref: "48009", bruto: 1.80, dto: 50, marca: "—" },
    }
  },
  {
    id: "disco-corte", desc: "Disco corte acero inox 115mm", familia: "Consumibles",
    unidad: "uni", img: "tapon",
    proveedores: {
      aram: { ref: "45110", bruto: 1.21, dto: 50, marca: "—" },
    }
  },
  {
    id: "guante-t9", desc: "Guante poliuretano/nylon SIFER T9 negro", familia: "Consumibles",
    unidad: "par", img: "tapon",
    proveedores: {
      aram: { ref: "36498", bruto: 1.56, dto: 50, marca: "—" },
    }
  },
  {
    id: "guante-t10", desc: "Guante poliuretano/nylon SIFER T10 negro", familia: "Consumibles",
    unidad: "par", img: "tapon",
    proveedores: {
      aram: { ref: "36499", bruto: 1.34, dto: 50, marca: "—" },
    }
  },
  {
    id: "paletina", desc: "Paletina pintor triple estándar N27", familia: "Consumibles",
    unidad: "uni", img: "tapon",
    proveedores: {
      aram: { ref: "49906", bruto: 3.06, dto: 50, marca: "—" },
    }
  },
  {
    id: "cinta-perforada", desc: "Cinta perforada 17×0,8mm (10m)", familia: "Consumibles",
    unidad: "rollo", img: "tapon",
    proveedores: {
      aram: { ref: "0835017", bruto: 9.08, dto: 50, marca: "—" },
    }
  },

  // === HERRAMIENTAS ===
  {
    id: "tijera-pvc", desc: "Tijera PVC Rothenberger 42", familia: "Herramientas",
    unidad: "uni", img: "tapon",
    proveedores: {
      aram: { ref: "52000", bruto: 73.95, dto: 18, marca: "—" },
    }
  },
  {
    id: "calibrador", desc: "Calibrador plástico 20-25-32mm", familia: "Herramientas",
    unidad: "uni", img: "tapon",
    proveedores: {
      aram: { ref: "CAL2032", bruto: 17.27, dto: 52, marca: "FE" },
    }
  },
  {
    id: "llave-inglesa", desc: "Llave inglesa gran apertura 6\"", familia: "Herramientas",
    unidad: "uni", img: "tapon",
    proveedores: {
      aram: { ref: "1500001509", bruto: 31.05, dto: 18, marca: "—" },
    }
  },
  {
    id: "tenaza-12", desc: "Tenaza canal 12\"", familia: "Herramientas",
    unidad: "uni", img: "tapon",
    proveedores: {
      aram: { ref: "70523", bruto: 1.80, dto: 50, marca: "—" },
    }
  },
  {
    id: "tenaza-10", desc: "Tenaza canal 10\"", familia: "Herramientas",
    unidad: "uni", img: "tapon",
    proveedores: {
      aram: { ref: "70522", bruto: 20.95, dto: 18, marca: "—" },
    }
  },
  {
    id: "cutter-eco", desc: "Cutter eco hoja larga 100×18mm", familia: "Herramientas",
    unidad: "uni", img: "tapon",
    proveedores: {
      aram: { ref: "95627", bruto: 3.67, dto: 50, marca: "—" },
    }
  },
  {
    id: "flexometro", desc: "Flexómetro forro caucho SIFER 5m", familia: "Herramientas",
    unidad: "uni", img: "tapon",
    proveedores: {
      aram: { ref: "90800", bruto: 5.68, dto: 50, marca: "—" },
    }
  },
  {
    id: "pistola-silicona", desc: "Pistola silicona profesional", familia: "Herramientas",
    unidad: "uni", img: "tapon",
    proveedores: {
      aram: { ref: "27219", bruto: 17.23, dto: 50, marca: "—" },
    }
  },
  {
    id: "broca-hormi", desc: "Broca hormigón SDS IMCO-Plus Ø6×110mm", familia: "Herramientas",
    unidad: "uni", img: "tapon",
    proveedores: {
      aram: { ref: "01090611", bruto: 3.82, dto: 50, marca: "—" },
    }
  },

  // === ALQUILER MAQUINARIA ===
  {
    id: "alq-elec-2285", desc: "Alquiler máquina electrofusión Nº2285 (€/día)", familia: "Alquiler Maquinaria",
    unidad: "día", img: "electro",
    proveedores: {
      aqua: { ref: "21707", bruto: 30.05, dto: 0, marca: "G" },
    }
  },
  {
    id: "alq-elec-5182", desc: "Alquiler máquina electrofusión Nº5182 (€/día)", familia: "Alquiler Maquinaria",
    unidad: "día", img: "electro",
    proveedores: {
      aqua: { ref: "36252", bruto: 55.00, dto: 0, marca: "AGRU" },
    }
  },

  // === GRIFERÍA / VARIOS ===
  {
    id: "grifo-bola-34-1", desc: "Grifo bola ¾\"×1\"", familia: "Griferías",
    unidad: "uni", img: "valvula",
    proveedores: {
      aram: { ref: "3059-05-2", bruto: 7.66, dto: 50, marca: "—" },
    }
  },
  {
    id: "cerradura-emas", desc: "Cerradura Ezcurra Emasesa", familia: "Varios",
    unidad: "uni", img: "tapon",
    proveedores: {
      aram: { ref: "AG37362", bruto: 35.00, dto: 0, marca: "—" },
    }
  },
  {
    id: "tornillo-lavabo", desc: "Juego tornillo lavabo 8×100", familia: "Varios",
    unidad: "uni", img: "tapon",
    proveedores: {
      aram: { ref: "2500A08", bruto: 1.35, dto: 50, marca: "—" },
    }
  },
];

// =========================================================
//  Helpers de cálculo
// =========================================================
const precioNeto = (prov) => prov ? +(prov.bruto * (1 - prov.dto / 100)).toFixed(4) : null;

// Devuelve el proveedor más barato de un producto, o null si solo tiene uno
const proveedorMasBarato = (producto) => {
  const aqua = producto.proveedores.aqua;
  const aram = producto.proveedores.aram;
  if (aqua && aram) {
    return precioNeto(aqua) <= precioNeto(aram) ? "aqua" : "aram";
  }
  return aqua ? "aqua" : "aram";
};

const FAMILIAS = [
  { nombre: "Todo", icon: Boxes },
  { nombre: "Multicapa", icon: Package },
  { nombre: "Válvulas", icon: Wrench },
  { nombre: "Filtros", icon: Wrench },
  { nombre: "Fittings Latón", icon: Hammer },
  { nombre: "Accesorios Latón", icon: Hammer },
  { nombre: "Tuberías", icon: Package },
  { nombre: "PVC Evacuación", icon: Package },
  { nombre: "Fittings PE", icon: Hammer },
  { nombre: "Electrofusión", icon: Wrench },
  { nombre: "Cobre", icon: Wrench },
  { nombre: "Baterías", icon: Boxes },
  { nombre: "Latiguillos", icon: Wrench },
  { nombre: "Aislamientos", icon: Package },
  { nombre: "Fijaciones", icon: Hammer },
  { nombre: "Racores Contador", icon: Hammer },
  { nombre: "Consumibles", icon: Boxes },
  { nombre: "Herramientas", icon: Wrench },
  { nombre: "Alquiler Maquinaria", icon: Wrench },
  { nombre: "Griferías", icon: Wrench },
  { nombre: "Varios", icon: Boxes },
];

// =========================================================
//  SVG productos (mismos del catálogo anterior)
// =========================================================
const ProductSVG = ({ type }) => {
  const id = useId();
  const w = 200, h = 200;
  const baseProps = { width: "100%", height: "100%", viewBox: `0 0 ${w} ${h}`, preserveAspectRatio: "xMidYMid meet" };
  switch (type) {
    case "valvula":
      return (
        <svg {...baseProps}>
          <defs>
            <linearGradient id={`${id}-laton`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#fde68a" /><stop offset="50%" stopColor="#d97706" /><stop offset="100%" stopColor="#92400e" />
            </linearGradient>
          </defs>
          <rect x="20" y="80" width="160" height="40" fill={`url(#${id}-laton)`} stroke="#451a03" strokeWidth="2" />
          <rect x="80" y="40" width="40" height="50" fill={`url(#${id}-laton)`} stroke="#451a03" strokeWidth="2" />
          <rect x="60" y="30" width="80" height="14" fill="#dc2626" stroke="#451a03" strokeWidth="2" />
          <circle cx="100" cy="100" r="16" fill="#451a03" />
        </svg>
      );
    case "fitting": case "fitting-pe":
      return (
        <svg {...baseProps}>
          <defs>
            <linearGradient id={`${id}-fit`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fde68a" /><stop offset="100%" stopColor="#92400e" />
            </linearGradient>
          </defs>
          <rect x="30" y="70" width="140" height="60" fill={`url(#${id}-fit)`} stroke="#451a03" strokeWidth="2" />
          <rect x="20" y="80" width="20" height="40" fill="#451a03" />
          <rect x="160" y="80" width="20" height="40" fill="#451a03" />
        </svg>
      );
    case "te":
      return (
        <svg {...baseProps}>
          <rect x="20" y="80" width="160" height="40" fill="#d97706" stroke="#451a03" strokeWidth="2" />
          <rect x="80" y="20" width="40" height="80" fill="#d97706" stroke="#451a03" strokeWidth="2" />
        </svg>
      );
    case "codo":
      return (
        <svg {...baseProps}>
          <path d="M 20 100 L 100 100 Q 120 100 120 80 L 120 20" stroke="#d97706" strokeWidth="40" fill="none" strokeLinecap="square" />
          <path d="M 20 100 L 100 100 Q 120 100 120 80 L 120 20" stroke="#451a03" strokeWidth="2" fill="none" />
        </svg>
      );
    case "machon":
      return (
        <svg {...baseProps}>
          <rect x="20" y="80" width="160" height="40" fill="#d97706" stroke="#451a03" strokeWidth="2" />
          <pattern id={`${id}-rosca`} x="0" y="0" width="6" height="40" patternUnits="userSpaceOnUse">
            <line x1="0" y1="0" x2="0" y2="40" stroke="#451a03" strokeWidth="1" />
          </pattern>
          <rect x="20" y="80" width="160" height="40" fill={`url(#${id}-rosca)`} opacity="0.4" />
        </svg>
      );
    case "tapon":
      return (
        <svg {...baseProps}>
          <rect x="60" y="50" width="80" height="100" fill="#d97706" stroke="#451a03" strokeWidth="2" />
          <rect x="50" y="60" width="100" height="20" fill="#92400e" stroke="#451a03" strokeWidth="2" />
        </svg>
      );
    case "reduccion":
      return (
        <svg {...baseProps}>
          <polygon points="20,70 90,70 110,90 110,110 90,130 20,130" fill="#d97706" stroke="#451a03" strokeWidth="2" />
          <rect x="110" y="85" width="70" height="30" fill="#d97706" stroke="#451a03" strokeWidth="2" />
        </svg>
      );
    case "filtro":
      return (
        <svg {...baseProps}>
          <rect x="20" y="80" width="50" height="40" fill="#d97706" stroke="#451a03" strokeWidth="2" />
          <rect x="130" y="80" width="50" height="40" fill="#d97706" stroke="#451a03" strokeWidth="2" />
          <polygon points="70,80 130,80 130,120 70,120 90,140 90,60" fill="#fbbf24" stroke="#451a03" strokeWidth="2" />
          <rect x="85" y="40" width="30" height="20" fill="#451a03" />
        </svg>
      );
    case "tubo-pex":
      return (
        <svg {...baseProps}>
          <ellipse cx="100" cy="100" rx="70" ry="60" fill="none" stroke="#fb923c" strokeWidth="14" />
          <ellipse cx="100" cy="100" rx="70" ry="60" fill="none" stroke="#fdba74" strokeWidth="2" />
        </svg>
      );
    case "tubo-pe":
      return (
        <svg {...baseProps}>
          <rect x="20" y="80" width="160" height="40" fill="#1e293b" stroke="#000" strokeWidth="2" />
          <rect x="20" y="92" width="160" height="14" fill="#3b82f6" />
          <text x="100" y="103" textAnchor="middle" fill="#fff" fontSize="7" fontWeight="bold" fontFamily="monospace">PE100 AENOR</text>
        </svg>
      );
    case "tubo-pvc":
      return (
        <svg {...baseProps}>
          <rect x="20" y="60" width="160" height="80" rx="3" fill="#f3f4f6" stroke="#374151" strokeWidth="2" />
          <text x="100" y="105" textAnchor="middle" fill="#374151" fontSize="11" fontWeight="bold" fontFamily="monospace">PVC AENOR</text>
        </svg>
      );
    case "te-pvc":
      return (
        <svg {...baseProps}>
          <rect x="20" y="80" width="160" height="40" fill="#f3f4f6" stroke="#374151" strokeWidth="2" />
          <rect x="80" y="20" width="40" height="80" fill="#f3f4f6" stroke="#374151" strokeWidth="2" />
        </svg>
      );
    case "codo-pvc":
      return (
        <svg {...baseProps}>
          <path d="M 20 100 L 100 100 Q 120 100 120 80 L 120 20" stroke="#f3f4f6" strokeWidth="40" fill="none" strokeLinecap="square" />
          <path d="M 20 100 L 100 100 Q 120 100 120 80 L 120 20" stroke="#374151" strokeWidth="2" fill="none" />
        </svg>
      );
    case "reduc-pvc":
      return (
        <svg {...baseProps}>
          <polygon points="20,60 90,60 130,90 130,110 90,140 20,140" fill="#f3f4f6" stroke="#374151" strokeWidth="2" />
          <rect x="130" y="85" width="50" height="30" fill="#f3f4f6" stroke="#374151" strokeWidth="2" />
        </svg>
      );
    case "electro":
      return (
        <svg {...baseProps}>
          <rect x="50" y="60" width="100" height="80" fill="#1e293b" stroke="#000" strokeWidth="2" />
          <circle cx="80" cy="100" r="6" fill="#f97316" />
          <circle cx="120" cy="100" r="6" fill="#f97316" />
          <rect x="55" y="120" width="90" height="3" fill="#fbbf24" />
        </svg>
      );
    case "cobre":
      return (
        <svg {...baseProps}>
          <rect x="20" y="85" width="160" height="30" fill="#fb923c" stroke="#7c2d12" strokeWidth="2" />
          <rect x="20" y="92" width="160" height="2" fill="#fdba74" />
          <text x="100" y="105" textAnchor="middle" fill="#7c2d12" fontSize="7" fontWeight="bold" fontFamily="monospace">CU</text>
        </svg>
      );
    case "mcap":
      return (
        <svg {...baseProps}>
          <rect x="20" y="80" width="160" height="40" fill="#fb923c" stroke="#7c2d12" strokeWidth="2" rx="2" />
          <rect x="20" y="86" width="160" height="2" fill="#fbbf24" />
          <rect x="20" y="112" width="160" height="2" fill="#fbbf24" />
        </svg>
      );
    case "bateria":
      return (
        <svg {...baseProps}>
          <rect x="40" y="40" width="120" height="120" fill="#475569" stroke="#0f172a" strokeWidth="2" />
          {[0,1,2,3].map(i => (
            <g key={i}>
              <circle cx={60 + i*30} cy="80" r="8" fill="#fbbf24" stroke="#0f172a" strokeWidth="1" />
              <circle cx={60 + i*30} cy="120" r="8" fill="#fbbf24" stroke="#0f172a" strokeWidth="1" />
            </g>
          ))}
        </svg>
      );
    case "latiguillo":
      return (
        <svg {...baseProps}>
          <pattern id={`${id}-trenza`} x="0" y="0" width="8" height="40" patternUnits="userSpaceOnUse">
            <rect width="8" height="40" fill="#9ca3af" />
            <line x1="0" y1="0" x2="8" y2="40" stroke="#6b7280" strokeWidth="1" />
            <line x1="8" y1="0" x2="0" y2="40" stroke="#6b7280" strokeWidth="1" />
          </pattern>
          <path d="M 30 60 Q 100 30 170 60 Q 100 130 30 160" stroke={`url(#${id}-trenza)`} strokeWidth="20" fill="none" />
          <circle cx="30" cy="60" r="14" fill="#fbbf24" stroke="#451a03" strokeWidth="2" />
          <circle cx="170" cy="60" r="14" fill="#fbbf24" stroke="#451a03" strokeWidth="2" />
        </svg>
      );
    case "aislamiento":
      return (
        <svg {...baseProps}>
          <ellipse cx="100" cy="100" rx="70" ry="50" fill="#1f2937" stroke="#000" strokeWidth="2" />
          <ellipse cx="100" cy="100" rx="50" ry="35" fill="#fb923c" />
          <text x="100" y="105" textAnchor="middle" fill="#fff" fontSize="9" fontWeight="bold" fontFamily="monospace">AISL</text>
        </svg>
      );
    case "abrazadera":
      return (
        <svg {...baseProps}>
          <circle cx="100" cy="100" r="50" fill="none" stroke="#374151" strokeWidth="14" />
          <circle cx="100" cy="100" r="50" fill="none" stroke="#9ca3af" strokeWidth="2" />
          <rect x="80" y="40" width="40" height="20" fill="#374151" />
        </svg>
      );
    default:
      return (
        <svg {...baseProps}>
          <rect x="50" y="50" width="100" height="100" fill="#9ca3af" stroke="#374151" strokeWidth="2" />
        </svg>
      );
  }
};

// Componente "logo" mini de proveedor
const TagProveedor = ({ tipo, size = "md" }) => {
  const isAqua = tipo === "aqua";
  const cls = size === "sm" ? "text-[9px] px-1.5 py-0.5" : "text-[10px] px-2 py-0.5";
  return (
    <span className={`inline-flex items-center gap-1 font-mono font-bold tracking-wider border ${cls} ${
      isAqua ? "bg-emerald-100 text-emerald-900 border-emerald-900" : "bg-amber-100 text-amber-900 border-amber-900"
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${isAqua ? "bg-emerald-600" : "bg-amber-600"}`} />
      {isAqua ? "AQUATUBO" : "ARAMBURU"}
    </span>
  );
};

// =========================================================
//  PANTALLA DE LOGIN
// =========================================================
function PantallaLogin({ onLogin, onAdminClick }) {
  const [nombre, setNombre] = useState("");
  const [obraId, setObraId] = useState("");
  const [nombrePersonalizado, setNombrePersonalizado] = useState("");
  const [crearObraAbierto, setCrearObraAbierto] = useState(false);
  const [nuevaObraNombre, setNuevaObraNombre] = useState("");
  const [nuevaObraDir, setNuevaObraDir] = useState("");
  const [creandoObra, setCreandoObra] = useState(false);
  const [errorCreaObra, setErrorCreaObra] = useState("");

  const nombreEfectivo = nombre === "Otro (escribir nombre)" ? nombrePersonalizado : nombre;
  const puedeEntrar = nombreEfectivo.trim().length > 1 && obraId;
  const puedeCrearObra = nuevaObraNombre.trim().length > 2 && !creandoObra;

  const handleSubmit = () => {
    if (!puedeEntrar) return;
    const obra = OBRAS.find(o => o.id === obraId);
    onLogin({ nombre: nombreEfectivo, obra });
  };

  const handleCrearObra = async () => {
    if (!puedeCrearObra) return;
    setCreandoObra(true);
    setErrorCreaObra("");
    try {
      const r = await fetch(BACKEND_URL + "/obra-nueva", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: nuevaObraNombre.trim(),
          dir: nuevaObraDir.trim(),
          creadaPor: nombreEfectivo || "anónimo"
        })
      });
      if (!r.ok) throw new Error("Error " + r.status);
      const obra = await r.json();
      // Añadirla a la lista en memoria para poder seleccionarla
      OBRAS = [...OBRAS, obra];
      setObraId(obra.id);
      setCrearObraAbierto(false);
      setNuevaObraNombre("");
      setNuevaObraDir("");
    } catch (e) {
      setErrorCreaObra("No se pudo crear la obra. Inténtalo de nuevo.");
    } finally {
      setCreandoObra(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-100 flex items-center justify-center p-4 font-mono"
         style={{ backgroundImage: "repeating-linear-gradient(45deg, transparent, transparent 30px, rgba(0,0,0,0.02) 30px, rgba(0,0,0,0.02) 31px)" }}>
      <div className="w-full max-w-md">
        <div className="bg-amber-500 border-4 border-stone-900 p-6 mb-3 shadow-[8px_8px_0_0_rgba(0,0,0,1)]">
          <div className="text-[10px] tracking-[0.3em] mb-2">ARA CORPORATE</div>
          <h1 className="font-black text-4xl leading-none mb-1" style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>
            PEDIDOS DE OBRA
          </h1>
          <div className="text-xs">Plataforma interna · Aquatubo · Aramburu</div>
        </div>

        <div className="bg-white border-4 border-stone-900 p-6 shadow-[8px_8px_0_0_rgba(0,0,0,1)] space-y-5">
          <div>
            <label className="font-bold text-xs tracking-widest text-stone-600 flex items-center gap-2 mb-2">
              <User className="w-3 h-3" /> NOMBRE DEL OPERARIO
            </label>
            <select
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="w-full border-2 border-stone-900 bg-white p-3 text-sm focus:outline-none focus:bg-amber-50 font-mono"
            >
              <option value="">— Selecciona quién eres —</option>
              {OPERARIOS.map(op => <option key={op} value={op}>{op}</option>)}
            </select>
            {nombre === "Otro (escribir nombre)" && (
              <input
                type="text"
                placeholder="Tu nombre y apellido"
                value={nombrePersonalizado}
                onChange={(e) => setNombrePersonalizado(e.target.value)}
                className="w-full border-2 border-stone-900 bg-amber-50 p-3 mt-2 text-sm focus:outline-none font-mono"
              />
            )}
          </div>

          <div>
            <label className="font-bold text-xs tracking-widest text-stone-600 flex items-center gap-2 mb-2">
              <Construction className="w-3 h-3" /> OBRA EN LA QUE TRABAJAS HOY
            </label>
            <select
              value={obraId}
              onChange={(e) => setObraId(e.target.value)}
              className="w-full border-2 border-stone-900 bg-white p-3 text-sm focus:outline-none focus:bg-amber-50 font-mono"
            >
              <option value="">— Selecciona la obra —</option>
              {OBRAS.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
            </select>

            {/* Botón "+ Nueva obra" o formulario de creación */}
            {!crearObraAbierto ? (
              <button
                onClick={() => setCrearObraAbierto(true)}
                className="mt-2 w-full text-xs font-bold text-stone-700 border-2 border-dashed border-stone-400 p-2 hover:bg-amber-50 hover:border-stone-900 transition-all"
              >
                + ¿NO ESTÁ TU OBRA? AÑADE UNA NUEVA
              </button>
            ) : (
              <div className="mt-2 border-2 border-stone-900 bg-amber-50 p-3 space-y-2">
                <div className="text-[10px] tracking-widest font-bold text-stone-700">NUEVA OBRA</div>
                <input
                  type="text"
                  placeholder="Nombre de la obra (ej: Calle Real 5)"
                  value={nuevaObraNombre}
                  onChange={(e) => setNuevaObraNombre(e.target.value)}
                  className="w-full border-2 border-stone-900 bg-white p-2 text-xs focus:outline-none font-mono"
                />
                <input
                  type="text"
                  placeholder="Dirección completa (opcional)"
                  value={nuevaObraDir}
                  onChange={(e) => setNuevaObraDir(e.target.value)}
                  className="w-full border-2 border-stone-900 bg-white p-2 text-xs focus:outline-none font-mono"
                />
                {errorCreaObra && (
                  <div className="text-[10px] text-red-700 font-bold">{errorCreaObra}</div>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => { setCrearObraAbierto(false); setNuevaObraNombre(""); setNuevaObraDir(""); setErrorCreaObra(""); }}
                    className="flex-1 text-[10px] font-bold tracking-widest p-2 border-2 border-stone-900 bg-white hover:bg-stone-100"
                  >
                    CANCELAR
                  </button>
                  <button
                    onClick={handleCrearObra}
                    disabled={!puedeCrearObra}
                    className={`flex-1 text-[10px] font-bold tracking-widest p-2 border-2 border-stone-900 ${
                      puedeCrearObra ? "bg-stone-900 text-amber-400 hover:bg-amber-400 hover:text-stone-900" : "bg-stone-200 text-stone-400 cursor-not-allowed"
                    }`}
                  >
                    {creandoObra ? "CREANDO…" : "✓ CREAR OBRA"}
                  </button>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={handleSubmit}
            disabled={!puedeEntrar}
            className={`w-full p-4 font-black text-sm tracking-widest border-2 border-stone-900 transition-all ${
              puedeEntrar
                ? "bg-stone-900 text-amber-400 hover:bg-amber-400 hover:text-stone-900 shadow-[4px_4px_0_0_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-1 hover:translate-y-1"
                : "bg-stone-200 text-stone-400 cursor-not-allowed"
            }`}
            style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}
          >
            ENTRAR AL CATÁLOGO →
          </button>

          <div className="text-[10px] text-stone-500 leading-relaxed border-t-2 border-stone-200 pt-3">
            Verás los precios de Aquatubo y Aramburu uno al lado del otro y podrás elegir el más barato para cada producto. Tu pedido quedará asignado a la obra seleccionada.
          </div>
        </div>

        <div className="text-center text-[10px] text-stone-500 mt-4 tracking-widest">
          ARA CORPORATE · SISTEMA INTERNO DE PEDIDOS
        </div>

        {onAdminClick && (
          <button onClick={onAdminClick}
                  className="mt-2 mx-auto block text-[10px] text-stone-400 hover:text-stone-700 tracking-widest">
            🔐 ACCESO ADMIN
          </button>
        )}
      </div>
    </div>
  );
}

// =========================================================
//  CARD DE PRODUCTO con comparativa lado a lado
// =========================================================
function CardProducto({ producto, cantidadAqua, cantidadAram, addAqua, addAram, removeAqua, removeAram, onClick }) {
  const aqua = producto.proveedores.aqua;
  const aram = producto.proveedores.aram;
  const ganador = proveedorMasBarato(producto);
  const netoAqua = aqua ? precioNeto(aqua) : null;
  const netoAram = aram ? precioNeto(aram) : null;
  const ahorroAbs = (aqua && aram) ? Math.abs(netoAqua - netoAram) : null;
  const ahorroPct = (aqua && aram) ? Math.round((ahorroAbs / Math.max(netoAqua, netoAram)) * 100) : null;

  return (
    <div className="bg-white border-2 border-stone-900 hover:shadow-[6px_6px_0_0_rgba(0,0,0,1)] transition-all">
      <button onClick={onClick} className="block w-full text-left">
        <div className="border-b-2 border-stone-900 bg-stone-50 aspect-square overflow-hidden">
          <ProductSVG type={producto.img} />
        </div>
        <div className="px-3 pt-3 pb-2">
          <div className="font-mono text-[9px] text-stone-500 tracking-widest mb-1">
            {producto.familia.toUpperCase()}
          </div>
          <div className="font-bold text-sm text-stone-900 leading-tight min-h-[2.5em]">
            {producto.desc}
          </div>
        </div>
      </button>

      {/* Comparativa lado a lado */}
      <div className="grid grid-cols-2 border-t-2 border-stone-900">
        {/* Columna AQUATUBO */}
        <div className={`p-3 border-r-2 border-stone-900 ${ganador === "aqua" ? "bg-emerald-50" : "bg-stone-50"}`}>
          <div className="flex items-center justify-between mb-1">
            <TagProveedor tipo="aqua" size="sm" />
            {ganador === "aqua" && aqua && aram && (
              <Trophy className="w-3.5 h-3.5 text-emerald-700" strokeWidth={2.5} />
            )}
          </div>
          {aqua ? (
            <>
              <div className="font-black text-lg text-stone-900 leading-none mt-1" style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>
                €{netoAqua.toFixed(2)}
              </div>
              <div className="font-mono text-[9px] text-stone-500 mb-2">/{producto.unidad}</div>
              <div className="flex items-center justify-between">
                {cantidadAqua === 0 ? (
                  <button onClick={(e) => { e.stopPropagation(); addAqua(); }}
                          className="w-full bg-stone-900 text-white text-[10px] py-1.5 font-bold tracking-wider hover:bg-emerald-700 transition-colors">
                    + AÑADIR
                  </button>
                ) : (
                  <div className="flex items-center w-full justify-between bg-emerald-700 text-white px-2 py-1">
                    <button onClick={(e) => { e.stopPropagation(); removeAqua(); }}><Minus className="w-3 h-3" /></button>
                    <span className="font-mono text-xs font-bold">{cantidadAqua}</span>
                    <button onClick={(e) => { e.stopPropagation(); addAqua(); }}><Plus className="w-3 h-3" /></button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="font-mono text-[10px] text-stone-400 italic mt-2">No disponible</div>
          )}
        </div>

        {/* Columna ARAMBURU */}
        <div className={`p-3 ${ganador === "aram" ? "bg-amber-50" : "bg-stone-50"}`}>
          <div className="flex items-center justify-between mb-1">
            <TagProveedor tipo="aram" size="sm" />
            {ganador === "aram" && aqua && aram && (
              <Trophy className="w-3.5 h-3.5 text-amber-700" strokeWidth={2.5} />
            )}
          </div>
          {aram ? (
            <>
              <div className="font-black text-lg text-stone-900 leading-none mt-1" style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>
                €{netoAram.toFixed(2)}
              </div>
              <div className="font-mono text-[9px] text-stone-500 mb-2">/{producto.unidad}</div>
              <div className="flex items-center justify-between">
                {cantidadAram === 0 ? (
                  <button onClick={(e) => { e.stopPropagation(); addAram(); }}
                          className="w-full bg-stone-900 text-white text-[10px] py-1.5 font-bold tracking-wider hover:bg-amber-700 transition-colors">
                    + AÑADIR
                  </button>
                ) : (
                  <div className="flex items-center w-full justify-between bg-amber-700 text-white px-2 py-1">
                    <button onClick={(e) => { e.stopPropagation(); removeAram(); }}><Minus className="w-3 h-3" /></button>
                    <span className="font-mono text-xs font-bold">{cantidadAram}</span>
                    <button onClick={(e) => { e.stopPropagation(); addAram(); }}><Plus className="w-3 h-3" /></button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="font-mono text-[10px] text-stone-400 italic mt-2">No disponible</div>
          )}
        </div>
      </div>

      {/* Footer indicador ahorro */}
      {ahorroPct !== null && ahorroPct > 0 && (
        <div className={`px-3 py-1.5 text-[10px] font-bold tracking-wider border-t-2 border-stone-900 ${
          ganador === "aqua" ? "bg-emerald-700 text-white" : "bg-amber-700 text-white"
        }`}>
          AHORRA €{ahorroAbs.toFixed(2)}/{producto.unidad} ELIGIENDO {ganador === "aqua" ? "AQUATUBO" : "ARAMBURU"} ({ahorroPct}%)
        </div>
      )}
    </div>
  );
}

// =========================================================
//  APP PRINCIPAL — gestor de catálogo y pedido
// =========================================================
function CatalogoApp({ usuario, onLogout }) {
  const [familia, setFamilia] = useState("Todo");
  const [busqueda, setBusqueda] = useState("");
  const [carritoAbierto, setCarritoAbierto] = useState(false);
  const [productoSel, setProductoSel] = useState(null);
  const [pedidoEnviado, setPedidoEnviado] = useState(false);
  const [datosPedidoEnviado, setDatosPedidoEnviado] = useState(null);
  const [notasPedido, setNotasPedido] = useState("");
  const [enviandoPedido, setEnviandoPedido] = useState(false);

  // Productos no listados (pedidos manualmente por el operario)
  const [lineasNoListadas, setLineasNoListadas] = useState([]);
  const [modalNoListadoAbierto, setModalNoListadoAbierto] = useState(false);

  // Carrito: { "<id>:aqua": cantidad, "<id>:aram": cantidad }
  const [carrito, setCarrito] = useState({});

  const productos = useMemo(() => {
    return CATALOGO.filter(p => {
      const matchFam = familia === "Todo" || p.familia === familia;
      const matchSearch = busqueda === "" ||
        p.desc.toLowerCase().includes(busqueda.toLowerCase()) ||
        (p.proveedores.aqua?.ref || "").toLowerCase().includes(busqueda.toLowerCase()) ||
        (p.proveedores.aram?.ref || "").toLowerCase().includes(busqueda.toLowerCase());
      return matchFam && matchSearch;
    });
  }, [familia, busqueda]);

  const getCant = (id, prov) => carrito[`${id}:${prov}`] || 0;
  const setCant = (id, prov, fn) => setCarrito(c => {
    const k = `${id}:${prov}`;
    const nuevo = fn(c[k] || 0);
    if (nuevo <= 0) { const r = {...c}; delete r[k]; return r; }
    return { ...c, [k]: nuevo };
  });
  const addProv = (id, prov) => setCant(id, prov, n => n + 1);
  const removeProv = (id, prov) => setCant(id, prov, n => Math.max(0, n - 1));
  const setExacta = (id, prov, n) => setCant(id, prov, () => n);

  // Cálculos del carrito
  const lineasCarrito = useMemo(() => {
    return Object.entries(carrito).map(([k, cant]) => {
      const [id, prov] = k.split(":");
      const p = CATALOGO.find(x => x.id === id);
      if (!p || !p.proveedores[prov]) return null;
      const proveedor = p.proveedores[prov];
      const neto = precioNeto(proveedor);
      return {
        id, prov, producto: p, proveedor, cantidad: cant, neto,
        subtotal: +(neto * cant).toFixed(2)
      };
    }).filter(Boolean);
  }, [carrito]);

  const totalAqua = lineasCarrito.filter(l => l.prov === "aqua").reduce((s, l) => s + l.subtotal, 0);
  const totalAram = lineasCarrito.filter(l => l.prov === "aram").reduce((s, l) => s + l.subtotal, 0);
  const totalGeneral = totalAqua + totalAram;
  const ivaAqua = totalAqua * 0.21;
  const ivaAram = totalAram * 0.21;
  const itemsCarrito = lineasCarrito.reduce((s, l) => s + l.cantidad, 0);

  // ¿hay productos donde no se eligió el más barato?
  const oportunidades = useMemo(() => {
    return lineasCarrito.filter(l => {
      const otroProv = l.prov === "aqua" ? "aram" : "aqua";
      const otro = l.producto.proveedores[otroProv];
      if (!otro) return false;
      return precioNeto(otro) < l.neto;
    });
  }, [lineasCarrito]);

  // === FUNCIONES DE ENVÍO/GUARDADO DE PEDIDO ===

  // Envía el pedido al backend (lo guarda en histórico)
  async function registrarPedidoEnBackend() {
    setEnviandoPedido(true);
    try {
      // Adaptar líneas al formato que espera el backend
      const linAqua = lineasCarrito.filter(l => l.prov === "aqua").map(l => ({
        ref: l.proveedor.ref,
        desc: l.producto.desc,
        cantidad: l.cantidad,
        unidad: l.producto.unidad,
        precioUnit: l.neto,
        importe: l.subtotal
      }));
      const linAram = lineasCarrito.filter(l => l.prov === "aram").map(l => ({
        ref: l.proveedor.ref,
        desc: l.producto.desc,
        cantidad: l.cantidad,
        unidad: l.producto.unidad,
        precioUnit: l.neto,
        importe: l.subtotal
      }));

      const r = await fetch(BACKEND_URL + "/enviar-pedido", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operario: usuario.nombre,
          obra: usuario.obra,
          lineasAqua: linAqua,
          lineasAram: linAram,
          lineasNoListado: lineasNoListadas,
          notas: notasPedido
        })
      });
      if (!r.ok) throw new Error("HTTP " + r.status);
      const data = await r.json();
      setDatosPedidoEnviado({
        pedidoId: data.pedidoId,
        fechaIso: new Date().toISOString(),
        operario: usuario.nombre,
        obra: usuario.obra,
        lineasAqua: linAqua,
        lineasAram: linAram,
        lineasNoListado: lineasNoListadas,
        notas: notasPedido,
        totalAqua, totalAram, totalGeneral,
        ivaAqua, ivaAram
      });
      setPedidoEnviado(true);
    } catch (e) {
      // Aun si el backend falla, dejamos que el operario tenga su PDF
      console.warn("[ARA] Error guardando pedido:", e.message);
      setDatosPedidoEnviado({
        pedidoId: "local-" + Date.now(),
        fechaIso: new Date().toISOString(),
        operario: usuario.nombre,
        obra: usuario.obra,
        lineasAqua: lineasCarrito.filter(l => l.prov === "aqua").map(l => ({
          ref: l.proveedor.ref, desc: l.producto.desc, cantidad: l.cantidad,
          unidad: l.producto.unidad, precioUnit: l.neto, importe: l.subtotal
        })),
        lineasAram: lineasCarrito.filter(l => l.prov === "aram").map(l => ({
          ref: l.proveedor.ref, desc: l.producto.desc, cantidad: l.cantidad,
          unidad: l.producto.unidad, precioUnit: l.neto, importe: l.subtotal
        })),
        lineasNoListado: lineasNoListadas,
        notas: notasPedido,
        totalAqua, totalAram, totalGeneral, ivaAqua, ivaAram,
        errorBackend: e.message
      });
      setPedidoEnviado(true);
    } finally {
      setEnviandoPedido(false);
    }
  }

  // Genera mensaje de WhatsApp para un proveedor
  function generarMensajeWhatsApp(prov) {
    const d = datosPedidoEnviado;
    if (!d) return "";
    const isAqua = prov === "aqua";
    const lineas = isAqua ? d.lineasAqua : d.lineasAram;
    const subtotal = lineas.reduce((s, l) => s + (l.importe || 0), 0);
    const iva = subtotal * 0.21;
    const total = subtotal + iva;
    const fecha = new Date(d.fechaIso).toLocaleDateString("es-ES");
    const noList = (d.lineasNoListado || []).filter(l => l.proveedor === prov || l.proveedor === "indistinto");

    let txt = `*PEDIDO ARA CORPORATE*\n`;
    txt += `Obra: ${d.obra.nombre}\n`;
    txt += `Fecha: ${fecha}\n`;
    txt += `Solicita: ${d.operario}\n\n`;
    txt += `*LÍNEAS:*\n`;
    lineas.forEach(l => {
      txt += `• ${l.cantidad} ${l.unidad} · ${l.desc} (ref ${l.ref}) — €${l.importe.toFixed(2)}\n`;
    });
    if (noList.length > 0) {
      txt += `\n*PRODUCTOS NO LISTADOS (confirmar precio):*\n`;
      noList.forEach(l => {
        txt += `• ${l.cantidad} ${l.unidad}: ${l.desc}\n`;
      });
    }
    txt += `\nBase: €${subtotal.toFixed(2)}\nIVA 21%: €${iva.toFixed(2)}\n*TOTAL: €${total.toFixed(2)}*\n`;
    if (d.notas) txt += `\n*Notas:*\n${d.notas}\n`;
    txt += `\n— ARA Corporate, CIF B90488222`;
    return txt;
  }

  // Genera y descarga PDF — proveedor: "aqua" | "aram" | "indistinto" | nombre libre
  async function descargarPDF(proveedor) {
    const d = datosPedidoEnviado;
    if (!d) return;

    const esAqua = proveedor === "aqua";
    const esAram = proveedor === "aram";
    const esIndistinto = proveedor === "indistinto";
    const esCustom = !esAqua && !esAram && !esIndistinto;

    const nombreProv = esAqua ? "AQUATUBO SL"
      : esAram ? "ARAMBURU GUZMÁN SLU"
      : esIndistinto ? "SIN PROVEEDOR ASIGNADO"
      : proveedor.toUpperCase();

    const formaPago = esAqua ? "60 días · Recibo domiciliado"
      : esAram ? "Contado"
      : "Pendiente de confirmar";

    // Líneas del catálogo (solo para aqua/aram)
    const lineasCatalogo = esAqua ? (d.lineasAqua || [])
      : esAram ? (d.lineasAram || [])
      : [];

    const total = esAqua ? d.totalAqua : esAram ? d.totalAram : 0;
    const iva   = esAqua ? d.ivaAqua   : esAram ? d.ivaAram   : 0;

    // Productos no listados de este proveedor
    const noListadosProv = (d.lineasNoListado || []).filter(
      l => l.proveedor === proveedor
    );

    if (lineasCatalogo.length === 0 && noListadosProv.length === 0) {
      alert(`No hay productos para ${nombreProv} en este pedido.`);
      return;
    }

    // Importación dinámica de jsPDF
    let jsPDFmod;
    try {
      jsPDFmod = await import("jspdf");
    } catch (e) {
      alert("No se pudo cargar el generador de PDF. Recarga la página y prueba de nuevo.");
      return;
    }
    const { jsPDF } = jsPDFmod;
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    let y = 15;

    // Cabecera
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text(`PEDIDO · ARA CORPORATE → ${nombreProv}`, 105, y, { align: "center" }); y += 6;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text("ARA Corporate Sociedad de Inversiones, SL · CIF B90488222", 105, y, { align: "center" }); y += 4;
    doc.text("Avd San Francisco Javier 9 P6 M9, 41018 Sevilla · Tel 640527426", 105, y, { align: "center" }); y += 8;

    doc.setDrawColor(0); doc.setLineWidth(0.5);
    doc.line(15, y, 195, y); y += 6;

    // Datos pedido
    doc.setFont("helvetica", "bold"); doc.setFontSize(10);
    doc.text("DATOS DEL PEDIDO", 15, y); y += 5;
    doc.setFont("helvetica", "normal"); doc.setFontSize(9);
    doc.text(`Fecha:        ${new Date(d.fechaIso).toLocaleDateString("es-ES", { dateStyle: "long" })}`, 15, y); y += 4;
    doc.text(`Obra:         ${d.obra.nombre}`, 15, y); y += 4;
    doc.text(`Dirección:    ${d.obra.dir || "-"}`, 15, y); y += 4;
    doc.text(`Solicita:     ${d.operario}`, 15, y); y += 4;
    doc.text(`Pedido ID:    ${d.pedidoId}`, 15, y); y += 4;
    doc.text(`Proveedor:    ${nombreProv}`, 15, y); y += 8;

    // Tabla de líneas del catálogo (solo aqua/aram)
    if (lineasCatalogo.length > 0) {
      doc.setFont("helvetica", "bold"); doc.setFontSize(11);
      doc.text(`LÍNEAS — ${nombreProv}`, 15, y); y += 5;

      // Cabecera tabla
      doc.setFillColor(230); doc.rect(15, y - 4, 180, 6, "F");
      doc.setFont("helvetica", "bold"); doc.setFontSize(8);
      doc.text("Cant", 17, y);
      doc.text("Ref", 32, y);
      doc.text("Descripción", 60, y);
      doc.text("P.unit", 152, y, { align: "right" });
      doc.text("Importe", 192, y, { align: "right" }); y += 4;
      doc.setFont("helvetica", "normal");

      lineasCatalogo.forEach(l => {
        if (y > 270) { doc.addPage(); y = 20; }
        const desc = l.desc.length > 50 ? l.desc.substring(0, 48) + ".." : l.desc;
        doc.text(String(l.cantidad), 17, y);
        doc.text(String(l.ref || "—"), 32, y);
        doc.text(desc, 60, y);
        doc.text("€" + l.precioUnit.toFixed(2), 152, y, { align: "right" });
        doc.text("€" + l.importe.toFixed(2), 192, y, { align: "right" });
        y += 4;
      });
      y += 2;
      doc.line(120, y, 195, y); y += 4;
      doc.setFont("helvetica", "normal"); doc.setFontSize(8);
      doc.text(`Subtotal: €${total.toFixed(2)}`, 192, y, { align: "right" }); y += 4;
      doc.text(`IVA 21%:  €${iva.toFixed(2)}`, 192, y, { align: "right" }); y += 4;
      doc.setFont("helvetica", "bold");
      doc.text(`TOTAL:    €${(total + iva).toFixed(2)}`, 192, y, { align: "right" }); y += 8;
    }

    // Productos no listados de este proveedor
    if (noListadosProv.length > 0) {
      if (y > 240) { doc.addPage(); y = 20; }
      doc.setFont("helvetica", "bold"); doc.setFontSize(11);
      doc.text("PRODUCTOS NO LISTADOS — CONFIRMAR PRECIO", 15, y); y += 5;
      doc.setFont("helvetica", "normal"); doc.setFontSize(9);
      noListadosProv.forEach(l => {
        doc.text(`· ${l.cantidad} ${l.unidad}: ${l.desc}`, 15, y);
        y += 4;
      });
      y += 4;
    }

    // Notas
    if (d.notas) {
      if (y > 240) { doc.addPage(); y = 20; }
      doc.setFont("helvetica", "bold"); doc.setFontSize(11);
      doc.text("NOTAS DEL OPERARIO", 15, y); y += 5;
      doc.setFont("helvetica", "normal"); doc.setFontSize(9);
      const lineasNotas = doc.splitTextToSize(d.notas, 175);
      doc.text(lineasNotas, 15, y); y += lineasNotas.length * 4 + 4;
    }

    // Total del pedido a este proveedor
    if (y > 250) { doc.addPage(); y = 20; }
    doc.setFillColor(255, 200, 0);
    doc.rect(15, y, 180, 12, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(14);
    doc.text(`TOTAL ${nombreProv}: €${(total + iva).toFixed(2)} IVA inc.`, 105, y + 8, { align: "center" });
    y += 18;

    // Pie
    doc.setFont("helvetica", "italic"); doc.setFontSize(8);
    doc.text(`Forma de pago: ${formaPago}`, 15, y); y += 4;
    doc.text("Documento generado automáticamente desde el sistema interno de pedidos ARA.", 15, y);

    const sufijoProv = esAqua ? "AQUATUBO" : esAram ? "ARAMBURU" : proveedor.replace(/[^a-z0-9]/gi, "_").toUpperCase();
    const fname = `Pedido_ARA_${sufijoProv}_${d.obra.nombre.replace(/[^a-z0-9]/gi, "_")}_${new Date(d.fechaIso).toISOString().slice(0,10)}.pdf`;
    doc.save(fname);
  }

  // === FUNCIONES DE PRODUCTO NO LISTADO ===
  function añadirNoListado({ desc, cantidad, unidad, proveedor }) {
    const item = {
      id: "nl-" + Date.now(),
      desc: desc.trim(),
      cantidad: parseFloat(cantidad) || 1,
      unidad: unidad || "uni",
      proveedor: proveedor || "indistinto"
    };
    setLineasNoListadas(prev => [...prev, item]);
    // También lo registramos en el backend para que el admin lo valide
    fetch(BACKEND_URL + "/producto-no-listado", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...item,
        pedidoPor: usuario.nombre,
        obra: usuario.obra
      })
    }).catch(() => { /* fallo silencioso, no bloquea al operario */ });
  }
  function quitarNoListado(id) {
    setLineasNoListadas(prev => prev.filter(l => l.id !== id));
  }

  if (pedidoEnviado) {
    const tieneAqua = (datosPedidoEnviado?.lineasAqua || []).length > 0;
    const tieneAram = (datosPedidoEnviado?.lineasAram || []).length > 0;
    // Proveedores custom: únicos nombres que no sean aqua/aram/indistinto
    const proveedoresCustom = [...new Set(
      (datosPedidoEnviado?.lineasNoListado || [])
        .map(l => l.proveedor)
        .filter(p => p && p !== "aqua" && p !== "aram" && p !== "indistinto")
    )];
    const tieneIndistinto = (datosPedidoEnviado?.lineasNoListado || [])
      .some(l => l.proveedor === "indistinto");
    return (
      <div className="min-h-screen bg-stone-100 flex items-center justify-center p-4 font-mono">
        <div className="w-full max-w-md">
          <div className="bg-emerald-500 border-4 border-stone-900 p-6 shadow-[8px_8px_0_0_rgba(0,0,0,1)] text-center">
            <Check className="w-14 h-14 mx-auto mb-2 text-stone-900" strokeWidth={3} />
            <h2 className="font-black text-2xl mb-1" style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>PEDIDO REGISTRADO</h2>
            <div className="text-[10px] tracking-widest opacity-80">ID: {datosPedidoEnviado?.pedidoId || "-"}</div>
          </div>

          <div className="bg-white border-4 border-t-0 border-stone-900 p-4 shadow-[8px_8px_0_0_rgba(0,0,0,1)] space-y-3">
            <div className="text-xs space-y-1 bg-stone-50 border-2 border-stone-900 p-3">
              <div><strong>Operario:</strong> {usuario.nombre}</div>
              <div><strong>Obra:</strong> {usuario.obra.nombre}</div>
              <div><strong>Total:</strong> €{((datosPedidoEnviado?.totalGeneral || 0) * 1.21).toFixed(2)} IVA inc.</div>
              {datosPedidoEnviado?.lineasNoListado?.length > 0 && (
                <div className="text-amber-700"><strong>{datosPedidoEnviado.lineasNoListado.length}</strong> producto(s) NO listado(s) — pendientes de validar precio</div>
              )}
            </div>

            <div className="text-[11px] text-stone-600 leading-relaxed">
              Comparte el pedido con tus proveedores:
            </div>

            {/* Botones PDF por proveedor */}
            {tieneAqua && (
              <button onClick={() => descargarPDF("aqua")}
                      className="w-full bg-stone-900 text-amber-400 p-4 font-black text-sm tracking-widest border-2 border-stone-900 hover:bg-amber-400 hover:text-stone-900 transition-all flex items-center justify-center gap-2"
                      style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>
                📄 PDF AQUATUBO
              </button>
            )}
            {tieneAram && (
              <button onClick={() => descargarPDF("aram")}
                      className="w-full bg-stone-700 text-amber-400 p-4 font-black text-sm tracking-widest border-2 border-stone-900 hover:bg-amber-400 hover:text-stone-900 transition-all flex items-center justify-center gap-2"
                      style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>
                📄 PDF ARAMBURU
              </button>
            )}

            {/* Botones PDF proveedores custom */}
            {proveedoresCustom.map(prov => (
              <button key={prov} onClick={() => descargarPDF(prov)}
                      className="w-full bg-blue-700 text-white p-4 font-black text-sm tracking-widest border-2 border-stone-900 hover:bg-blue-800 transition-all flex items-center justify-center gap-2"
                      style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>
                {`📄 PDF ${prov.toUpperCase()}`}
              </button>
            ))}
            {tieneIndistinto && (
              <button onClick={() => descargarPDF("indistinto")}
                      className="w-full bg-stone-500 text-white p-4 font-black text-sm tracking-widest border-2 border-stone-900 hover:bg-stone-600 transition-all flex items-center justify-center gap-2"
                      style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>
                📄 PDF SIN PROVEEDOR
              </button>
            )}

            {/* Botones WhatsApp por proveedor */}
            {tieneAqua && (
              <a href={`https://wa.me/?text=${encodeURIComponent(generarMensajeWhatsApp("aqua"))}`}
                 target="_blank" rel="noopener noreferrer"
                 className="w-full bg-emerald-700 text-white p-3 font-black text-xs tracking-widest border-2 border-stone-900 hover:bg-emerald-800 transition-all flex items-center justify-center gap-2"
                 style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>
                💬 ENVIAR PEDIDO AQUATUBO POR WHATSAPP
              </a>
            )}
            {tieneAram && (
              <a href={`https://wa.me/?text=${encodeURIComponent(generarMensajeWhatsApp("aram"))}`}
                 target="_blank" rel="noopener noreferrer"
                 className="w-full bg-amber-700 text-white p-3 font-black text-xs tracking-widest border-2 border-stone-900 hover:bg-amber-800 transition-all flex items-center justify-center gap-2"
                 style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>
                💬 ENVIAR PEDIDO ARAMBURU POR WHATSAPP
              </a>
            )}

            {datosPedidoEnviado?.errorBackend && (
              <div className="text-[10px] text-amber-700 bg-amber-50 border border-amber-700 p-2">
                ⚠ El pedido no se guardó en el sistema central, pero puedes descargarlo en PDF y compartirlo manualmente.
              </div>
            )}

            <div className="border-t-2 border-stone-200 pt-3 space-y-2">
              <button onClick={() => {
                        setCarrito({});
                        setLineasNoListadas([]);
                        setNotasPedido("");
                        setPedidoEnviado(false);
                        setDatosPedidoEnviado(null);
                        setCarritoAbierto(false);
                      }}
                      className="w-full bg-stone-900 text-amber-400 p-3 font-black tracking-widest text-xs border-2 border-stone-900 hover:bg-amber-400 hover:text-stone-900 transition-all"
                      style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>
                ↻ HACER OTRO PEDIDO
              </button>
              <button onClick={onLogout}
                      className="w-full bg-stone-200 text-stone-900 p-3 font-bold tracking-widest text-[10px] border-2 border-stone-900 hover:bg-stone-300 transition-all">
                CERRAR SESIÓN
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-100 font-mono"
         style={{ backgroundImage: "repeating-linear-gradient(45deg, transparent, transparent 30px, rgba(0,0,0,0.02) 30px, rgba(0,0,0,0.02) 31px)" }}>

      {/* HEADER */}
      <header className="bg-amber-500 border-b-4 border-stone-900 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div>
            <div className="text-[9px] tracking-widest opacity-70">ARA CORPORATE</div>
            <h1 className="font-black text-xl leading-none" style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>
              CATÁLOGO DE OBRA
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden sm:block text-right">
              <div className="text-[9px] tracking-widest opacity-70">{usuario.nombre.toUpperCase()}</div>
              <div className="text-xs font-bold flex items-center gap-1 justify-end">
                <Construction className="w-3 h-3" /> {usuario.obra.nombre}
              </div>
            </div>
            <button onClick={() => setCarritoAbierto(true)}
                    className="relative bg-stone-900 text-amber-400 px-4 py-2 font-black border-2 border-stone-900 hover:bg-amber-400 hover:text-stone-900 transition-colors">
              <ShoppingCart className="w-4 h-4 inline mr-1" />
              <span className="text-sm">{itemsCarrito}</span>
              {itemsCarrito > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-600 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center border-2 border-stone-900">
                  •
                </span>
              )}
            </button>
            <button onClick={onLogout}
                    className="bg-stone-900 text-amber-400 p-2 border-2 border-stone-900 hover:bg-stone-700 transition-colors"
                    title="Cerrar sesión">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
        {/* Banda info móvil */}
        <div className="sm:hidden border-t-2 border-stone-900 bg-amber-400 px-4 py-1.5 text-[10px] flex items-center justify-between">
          <span className="font-bold truncate">{usuario.nombre}</span>
          <span className="flex items-center gap-1"><Construction className="w-3 h-3" /> <span className="font-bold">{usuario.obra.nombre}</span></span>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-4">
        {/* Buscador */}
        <div className="relative mb-4">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            placeholder="Buscar producto, código, referencia…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full pl-10 pr-3 py-3 border-2 border-stone-900 bg-white text-sm focus:outline-none focus:bg-amber-50 font-mono"
          />
        </div>

        {/* Familias scroll horizontal */}
        <div className="flex gap-2 overflow-x-auto pb-3 mb-4 -mx-4 px-4">
          {FAMILIAS.map(f => {
            const Icon = f.icon;
            const activo = familia === f.nombre;
            return (
              <button key={f.nombre} onClick={() => setFamilia(f.nombre)}
                      className={`shrink-0 px-3 py-2 border-2 border-stone-900 text-xs font-bold tracking-wider flex items-center gap-1.5 transition-all ${
                        activo ? "bg-stone-900 text-amber-400" : "bg-white text-stone-900 hover:bg-amber-100"
                      }`}>
                <Icon className="w-3 h-3" />
                {f.nombre.toUpperCase()}
              </button>
            );
          })}
        </div>

        {/* Stats banner */}
        <div className="bg-white border-2 border-stone-900 mb-4 p-3 grid grid-cols-3 gap-3 text-xs">
          <div>
            <div className="text-[9px] tracking-widest text-stone-500">PRODUCTOS</div>
            <div className="font-black text-lg text-stone-900" style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>
              {productos.length}
            </div>
          </div>
          <div className="border-x-2 border-stone-200 px-3">
            <div className="text-[9px] tracking-widest text-stone-500">CON COMPARATIVA</div>
            <div className="font-black text-lg text-stone-900" style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>
              {productos.filter(p => p.proveedores.aqua && p.proveedores.aram).length}
            </div>
          </div>
          <div>
            <div className="text-[9px] tracking-widest text-stone-500">FAMILIAS</div>
            <div className="font-black text-lg text-stone-900" style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>
              {FAMILIAS.length - 1}
            </div>
          </div>
        </div>

        {/* Grid productos */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {productos.map(p => (
            <CardProducto
              key={p.id}
              producto={p}
              cantidadAqua={getCant(p.id, "aqua")}
              cantidadAram={getCant(p.id, "aram")}
              addAqua={() => addProv(p.id, "aqua")}
              addAram={() => addProv(p.id, "aram")}
              removeAqua={() => removeProv(p.id, "aqua")}
              removeAram={() => removeProv(p.id, "aram")}
              onClick={() => setProductoSel(p)}
            />
          ))}
        </div>

        {productos.length === 0 && (
          <div className="text-center py-12 text-stone-500 font-mono text-sm">
            No hay productos que coincidan con tu búsqueda
          </div>
        )}
      </div>

      {/* DRAWER CARRITO */}
      {carritoAbierto && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-stone-900/40" onClick={() => setCarritoAbierto(false)} />
          <div className="ml-auto w-full max-w-2xl bg-stone-100 border-l-4 border-stone-900 relative overflow-y-auto">
            {/* Header drawer */}
            <div className="sticky top-0 bg-amber-500 border-b-4 border-stone-900 p-4 flex items-center justify-between z-10">
              <div>
                <div className="text-[10px] tracking-widest opacity-70">PEDIDO PARA</div>
                <h2 className="font-black text-xl" style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>
                  {usuario.obra.nombre.toUpperCase()}
                </h2>
                <div className="text-[10px] tracking-widest opacity-70 mt-0.5">SOLICITA: {usuario.nombre.toUpperCase()}</div>
              </div>
              <button onClick={() => setCarritoAbierto(false)} className="bg-stone-900 text-amber-400 p-2 border-2 border-stone-900">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {lineasCarrito.length === 0 && lineasNoListadas.length === 0 ? (
                <div className="text-center py-12 text-stone-500 text-sm space-y-4">
                  <div>
                    Aún no has añadido productos.<br />
                    Vuelve al catálogo y añade lo que necesites.
                  </div>
                  <button onClick={() => setModalNoListadoAbierto(true)}
                          className="text-xs font-bold text-stone-700 border-2 border-dashed border-stone-400 px-4 py-2 hover:bg-amber-50 hover:border-stone-900 transition-all">
                    + AÑADIR UN PRODUCTO QUE NO ESTÁ EN EL CATÁLOGO
                  </button>
                </div>
              ) : (
                <>
                  {/* AVISO oportunidades */}
                  {oportunidades.length > 0 && (
                    <div className="bg-amber-100 border-2 border-amber-700 p-3">
                      <div className="flex gap-2 items-start">
                        <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                        <div className="text-xs">
                          <div className="font-bold mb-1">Hay {oportunidades.length} producto{oportunidades.length>1?"s":""} que puedes pedir más barato:</div>
                          <ul className="space-y-1 font-mono text-[11px]">
                            {oportunidades.slice(0, 3).map((l, i) => {
                              const otroProv = l.prov === "aqua" ? "aram" : "aqua";
                              const otro = l.producto.proveedores[otroProv];
                              const ahorro = (precioNeto(l.proveedor) - precioNeto(otro)) * l.cantidad;
                              return (
                                <li key={i}>
                                  · {l.producto.desc}: ahorrarías <strong>€{ahorro.toFixed(2)}</strong> con {otroProv === "aqua" ? "Aquatubo" : "Aramburu"}
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Sub-pedido AQUATUBO */}
                  {lineasCarrito.some(l => l.prov === "aqua") && (
                    <div className="bg-white border-2 border-stone-900">
                      <div className="bg-emerald-700 text-white px-3 py-2 flex items-center justify-between border-b-2 border-stone-900">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-300" />
                          <span className="font-black tracking-wider text-sm" style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>SUB-PEDIDO AQUATUBO</span>
                        </div>
                        <span className="text-xs">60 días</span>
                      </div>
                      <div className="divide-y-2 divide-stone-200">
                        {lineasCarrito.filter(l => l.prov === "aqua").map(l => (
                          <div key={l.id + l.prov} className="p-3 flex gap-3">
                            <div className="w-14 h-14 border-2 border-stone-900 bg-stone-50 shrink-0">
                              <ProductSVG type={l.producto.img} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-[9px] font-mono text-stone-500">{l.proveedor.ref}</div>
                              <div className="text-xs font-bold leading-tight mb-1">{l.producto.desc}</div>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1 border-2 border-stone-900">
                                  <button onClick={() => removeProv(l.id, l.prov)} className="px-2"><Minus className="w-3 h-3" /></button>
                                  <input type="number" min="0" value={l.cantidad}
                                         onChange={(e) => setExacta(l.id, l.prov, parseInt(e.target.value) || 0)}
                                         className="w-12 text-center font-mono text-xs py-1 bg-amber-50 focus:outline-none" />
                                  <button onClick={() => addProv(l.id, l.prov)} className="px-2"><Plus className="w-3 h-3" /></button>
                                </div>
                                <div className="text-right">
                                  <div className="font-black text-sm" style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>€{l.subtotal.toFixed(2)}</div>
                                  <div className="text-[9px] text-stone-500 font-mono">€{l.neto.toFixed(2)}/{l.producto.unidad}</div>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="px-3 py-2 bg-emerald-50 border-t-2 border-stone-900 flex justify-between text-xs">
                        <span>Subtotal Aquatubo</span>
                        <span className="font-bold">€{totalAqua.toFixed(2)}</span>
                      </div>
                      <div className="px-3 py-2 bg-emerald-50 flex justify-between text-xs border-t border-emerald-200">
                        <span>IVA 21%</span>
                        <span className="font-bold">€{ivaAqua.toFixed(2)}</span>
                      </div>
                      <div className="px-3 py-2 bg-emerald-700 text-white flex justify-between border-t-2 border-stone-900">
                        <span className="font-black tracking-wider text-sm" style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>TOTAL AQUATUBO</span>
                        <span className="font-black text-base" style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>€{(totalAqua + ivaAqua).toFixed(2)}</span>
                      </div>
                    </div>
                  )}

                  {/* Sub-pedido ARAMBURU */}
                  {lineasCarrito.some(l => l.prov === "aram") && (
                    <div className="bg-white border-2 border-stone-900">
                      <div className="bg-amber-700 text-white px-3 py-2 flex items-center justify-between border-b-2 border-stone-900">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-amber-300" />
                          <span className="font-black tracking-wider text-sm" style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>SUB-PEDIDO ARAMBURU</span>
                        </div>
                        <span className="text-xs">Contado</span>
                      </div>
                      <div className="divide-y-2 divide-stone-200">
                        {lineasCarrito.filter(l => l.prov === "aram").map(l => (
                          <div key={l.id + l.prov} className="p-3 flex gap-3">
                            <div className="w-14 h-14 border-2 border-stone-900 bg-stone-50 shrink-0">
                              <ProductSVG type={l.producto.img} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-[9px] font-mono text-stone-500">{l.proveedor.ref}</div>
                              <div className="text-xs font-bold leading-tight mb-1">{l.producto.desc}</div>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1 border-2 border-stone-900">
                                  <button onClick={() => removeProv(l.id, l.prov)} className="px-2"><Minus className="w-3 h-3" /></button>
                                  <input type="number" min="0" value={l.cantidad}
                                         onChange={(e) => setExacta(l.id, l.prov, parseInt(e.target.value) || 0)}
                                         className="w-12 text-center font-mono text-xs py-1 bg-amber-50 focus:outline-none" />
                                  <button onClick={() => addProv(l.id, l.prov)} className="px-2"><Plus className="w-3 h-3" /></button>
                                </div>
                                <div className="text-right">
                                  <div className="font-black text-sm" style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>€{l.subtotal.toFixed(2)}</div>
                                  <div className="text-[9px] text-stone-500 font-mono">€{l.neto.toFixed(2)}/{l.producto.unidad}</div>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="px-3 py-2 bg-amber-50 border-t-2 border-stone-900 flex justify-between text-xs">
                        <span>Subtotal Aramburu</span>
                        <span className="font-bold">€{totalAram.toFixed(2)}</span>
                      </div>
                      <div className="px-3 py-2 bg-amber-50 flex justify-between text-xs border-t border-amber-200">
                        <span>IVA 21%</span>
                        <span className="font-bold">€{ivaAram.toFixed(2)}</span>
                      </div>
                      <div className="px-3 py-2 bg-amber-700 text-white flex justify-between border-t-2 border-stone-900">
                        <span className="font-black tracking-wider text-sm" style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>TOTAL ARAMBURU</span>
                        <span className="font-black text-base" style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>€{(totalAram + ivaAram).toFixed(2)}</span>
                      </div>
                    </div>
                  )}

                  {/* Productos no listados añadidos */}
                  {lineasNoListadas.length > 0 && (
                    <div className="bg-white border-2 border-stone-900">
                      <div className="bg-stone-700 text-white px-3 py-2 flex items-center justify-between border-b-2 border-stone-900">
                        <span className="font-black tracking-wider text-sm" style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>PRODUCTOS NO LISTADOS</span>
                        <span className="text-[9px] bg-amber-400 text-stone-900 px-2 py-0.5 font-bold">PENDIENTE PRECIO</span>
                      </div>
                      <div className="divide-y-2 divide-stone-200">
                        {lineasNoListadas.map(l => (
                          <div key={l.id} className="p-3 flex justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-bold leading-tight">{l.desc}</div>
                              <div className="text-[10px] font-mono text-stone-500 mt-0.5">
                                {l.cantidad} {l.unidad}
                                {l.proveedor !== "indistinto" && (
                                  <> · prov: <strong>{l.proveedor === "aqua" ? "Aquatubo" : "Aramburu"}</strong></>
                                )}
                              </div>
                            </div>
                            <button onClick={() => quitarNoListado(l.id)}
                                    className="text-stone-500 hover:text-red-700 p-1">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Botón añadir producto no listado */}
                  <button onClick={() => setModalNoListadoAbierto(true)}
                          className="w-full text-xs font-bold text-stone-700 border-2 border-dashed border-stone-400 p-3 hover:bg-amber-50 hover:border-stone-900 transition-all">
                    + AÑADIR PRODUCTO QUE NO ESTÁ EN EL CATÁLOGO
                  </button>

                  {/* Campo de notas */}
                  <div>
                    <label className="font-bold text-[10px] tracking-widest text-stone-600 mb-1 block">
                      📝 NOTAS PARA EL PEDIDO (opcional)
                    </label>
                    <textarea
                      value={notasPedido}
                      onChange={(e) => setNotasPedido(e.target.value)}
                      placeholder="Ej: Urgente, llevar antes del jueves · Recoger en obra, no en oficina · Entregar en planta 2..."
                      rows={3}
                      className="w-full border-2 border-stone-900 bg-white p-2 text-xs focus:outline-none focus:bg-amber-50 font-mono resize-none"
                    />
                  </div>

                  {/* TOTAL GENERAL */}
                  <div className="bg-stone-900 text-amber-400 p-4 border-2 border-stone-900">
                    <div className="flex justify-between items-baseline mb-1">
                      <span className="text-xs tracking-widest opacity-80">TOTAL GENERAL (IVA INC.)</span>
                    </div>
                    <div className="font-black text-3xl" style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>
                      €{(totalGeneral * 1.21).toFixed(2)}
                    </div>
                    <div className="text-xs opacity-80 mt-1">
                      Base €{totalGeneral.toFixed(2)} · IVA €{(totalGeneral * 0.21).toFixed(2)}
                    </div>
                    {lineasNoListadas.length > 0 && (
                      <div className="text-[10px] mt-2 bg-amber-400 text-stone-900 px-2 py-1 inline-block font-bold">
                        + {lineasNoListadas.length} producto(s) no listado(s) sin precio
                      </div>
                    )}
                  </div>

                  <button
                    onClick={registrarPedidoEnBackend}
                    disabled={enviandoPedido}
                    className={`w-full border-2 border-stone-900 p-4 font-black tracking-widest transition-all ${
                      enviandoPedido
                        ? "bg-stone-300 text-stone-600 cursor-wait"
                        : "bg-amber-500 text-stone-900 hover:bg-stone-900 hover:text-amber-400 shadow-[4px_4px_0_0_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-1 hover:translate-y-1"
                    }`}
                    style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}
                  >
                    {enviandoPedido ? "REGISTRANDO…" : "REGISTRAR PEDIDO →"}
                  </button>

                  <div className="text-[10px] text-stone-500 text-center leading-relaxed pt-2">
                    Al confirmar, el pedido se guarda y podrás descargarlo en PDF o enviarlo por WhatsApp a tus proveedores.
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL FICHA PRODUCTO */}
      {productoSel && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-stone-900/50" onClick={() => setProductoSel(null)} />
          <div className="relative bg-white border-4 border-stone-900 w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-[8px_8px_0_0_rgba(0,0,0,1)]">
            <button onClick={() => setProductoSel(null)} className="absolute top-3 right-3 z-10 bg-stone-900 text-amber-400 p-1.5 border-2 border-stone-900">
              <X className="w-4 h-4" />
            </button>
            <div className="aspect-square bg-stone-50 border-b-2 border-stone-900">
              <ProductSVG type={productoSel.img} />
            </div>
            <div className="p-5">
              <div className="font-mono text-[10px] tracking-widest text-stone-500 mb-1">
                {productoSel.familia.toUpperCase()}
              </div>
              <h3 className="font-black text-xl mb-3 leading-tight" style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>
                {productoSel.desc}
              </h3>

              {/* Detalle por proveedor */}
              <div className="grid grid-cols-1 gap-3">
                {["aqua", "aram"].map(provKey => {
                  const prov = productoSel.proveedores[provKey];
                  if (!prov) {
                    return (
                      <div key={provKey} className="border-2 border-dashed border-stone-300 p-3 text-center text-[10px] text-stone-400 italic">
                        <TagProveedor tipo={provKey} size="sm" />
                        <div className="mt-1">No disponible en este proveedor</div>
                      </div>
                    );
                  }
                  const neto = precioNeto(prov);
                  const ganador = proveedorMasBarato(productoSel) === provKey;
                  return (
                    <div key={provKey} className={`border-2 border-stone-900 p-3 ${ganador && productoSel.proveedores.aqua && productoSel.proveedores.aram ? (provKey === "aqua" ? "bg-emerald-50" : "bg-amber-50") : "bg-white"}`}>
                      <div className="flex items-center justify-between mb-2">
                        <TagProveedor tipo={provKey} />
                        {ganador && productoSel.proveedores.aqua && productoSel.proveedores.aram && (
                          <span className="bg-stone-900 text-amber-400 text-[9px] px-2 py-0.5 font-bold tracking-wider flex items-center gap-1">
                            <Trophy className="w-2.5 h-2.5" /> MÁS BARATO
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
                        <div><span className="text-stone-500">REF:</span> <strong>{prov.ref}</strong></div>
                        <div><span className="text-stone-500">MARCA:</span> <strong>{prov.marca}</strong></div>
                        <div><span className="text-stone-500">PVP TARIFA:</span> <strong className="line-through">€{prov.bruto.toFixed(2)}</strong></div>
                        <div><span className="text-stone-500">DTO:</span> <strong className="text-emerald-700">−{prov.dto}%</strong></div>
                      </div>
                      <div className="mt-3 pt-3 border-t-2 border-stone-200 flex items-baseline justify-between">
                        <div>
                          <div className="text-[10px] tracking-widest text-stone-500">PRECIO NETO</div>
                          <div className="font-black text-2xl" style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>€{neto.toFixed(2)}</div>
                          <div className="text-[10px] text-stone-500">/{productoSel.unidad}</div>
                        </div>
                        <button onClick={() => addProv(productoSel.id, provKey)}
                                className={`px-4 py-2 font-bold text-xs tracking-wider border-2 border-stone-900 ${
                                  provKey === "aqua" ? "bg-emerald-700 text-white hover:bg-emerald-900" : "bg-amber-700 text-white hover:bg-amber-900"
                                }`}>
                          + AÑADIR
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PRODUCTO NO LISTADO */}
      {modalNoListadoAbierto && (
        <ModalProductoNoListado
          onCancelar={() => setModalNoListadoAbierto(false)}
          onAñadir={(item) => {
            añadirNoListado(item);
            setModalNoListadoAbierto(false);
            // Abrir el carrito tras añadirlo
            setTimeout(() => setCarritoAbierto(true), 100);
          }}
        />
      )}

      {/* BOTÓN FLOTANTE "+ Producto no listado" — solo si NO está abierto el carrito ni el modal */}
      {!carritoAbierto && !productoSel && !modalNoListadoAbierto && (
        <button
          onClick={() => setModalNoListadoAbierto(true)}
          className="fixed bottom-4 left-4 z-20 bg-stone-900 text-amber-400 border-2 border-stone-900 shadow-[4px_4px_0_0_rgba(0,0,0,1)] hover:bg-amber-400 hover:text-stone-900 transition-all px-3 py-2 text-[10px] font-black tracking-widest"
          style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}
        >
          + PEDIR PRODUCTO NO LISTADO
        </button>
      )}
    </div>
  );
}

// =========================================================
//  Modal: pedir un producto que no está en el catálogo
// =========================================================
function ModalProductoNoListado({ onCancelar, onAñadir }) {
  const [desc, setDesc] = useState("");
  const [cantidad, setCantidad] = useState(1);
  const [unidad, setUnidad] = useState("uni");
  const [proveedor, setProveedor] = useState("indistinto");
  const [proveedorCustom, setProveedorCustom] = useState("");

  const proveedorFinal = proveedor === "otro"
    ? (proveedorCustom.trim() || "otro")
    : proveedor;

  const puedeAñadir = desc.trim().length > 2 && cantidad > 0 &&
    (proveedor !== "otro" || proveedorCustom.trim().length > 1);

  const handleAñadir = () => {
    if (!puedeAñadir) return;
    onAñadir({ desc, cantidad, unidad, proveedor: proveedorFinal });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-stone-900/50" onClick={onCancelar} />
      <div className="relative bg-white border-4 border-stone-900 w-full max-w-md shadow-[8px_8px_0_0_rgba(0,0,0,1)]">
        <div className="bg-amber-500 border-b-4 border-stone-900 p-4 flex items-center justify-between">
          <h3 className="font-black text-base" style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>
            PEDIR PRODUCTO NO LISTADO
          </h3>
          <button onClick={onCancelar} className="bg-stone-900 text-amber-400 p-1.5 border-2 border-stone-900">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <div className="text-[11px] text-stone-600">
            Indica qué producto necesitas. Lo añadirás al pedido sin precio y el administrador lo confirmará con el proveedor.
          </div>

          <div>
            <label className="font-bold text-[10px] tracking-widest text-stone-700 mb-1 block">
              DESCRIPCIÓN DEL PRODUCTO
            </label>
            <textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="Ej: Codo PVC evacuación 200mm, color blanco..."
              rows={3}
              className="w-full border-2 border-stone-900 bg-white p-2 text-xs focus:outline-none focus:bg-amber-50 font-mono resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-[10px] tracking-widest text-stone-700 mb-1 block">
                CANTIDAD
              </label>
              <input
                type="number"
                min="0.01"
                step="any"
                value={cantidad}
                onChange={(e) => setCantidad(parseFloat(e.target.value) || 0)}
                className="w-full border-2 border-stone-900 bg-white p-2 text-xs focus:outline-none focus:bg-amber-50 font-mono"
              />
            </div>
            <div>
              <label className="font-bold text-[10px] tracking-widest text-stone-700 mb-1 block">
                UNIDAD
              </label>
              <select
                value={unidad}
                onChange={(e) => setUnidad(e.target.value)}
                className="w-full border-2 border-stone-900 bg-white p-2 text-xs focus:outline-none focus:bg-amber-50 font-mono"
              >
                <option value="uni">unidades</option>
                <option value="m">metros</option>
                <option value="kg">kilos</option>
                <option value="L">litros</option>
                <option value="caja">cajas</option>
                <option value="rollo">rollos</option>
                <option value="par">pares</option>
                <option value="día">días</option>
              </select>
            </div>
          </div>

          <div>
            <label className="font-bold text-[10px] tracking-widest text-stone-700 mb-1 block">
              PROVEEDOR PREFERIDO
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { v: "indistinto", t: "Cualquiera" },
                { v: "aqua",       t: "Aquatubo" },
                { v: "aram",       t: "Aramburu" },
                { v: "otro",       t: "Otro..." },
              ].map(opt => (
                <button key={opt.v} onClick={() => setProveedor(opt.v)}
                        className={`p-2 text-[10px] font-bold tracking-widest border-2 border-stone-900 transition-all ${
                          proveedor === opt.v
                            ? (opt.v === "aqua" ? "bg-emerald-700 text-white"
                               : opt.v === "aram" ? "bg-amber-700 text-white"
                               : opt.v === "otro" ? "bg-blue-700 text-white"
                               : "bg-stone-900 text-amber-400")
                            : "bg-white text-stone-900 hover:bg-stone-100"
                        }`}>
                  {opt.t}
                </button>
              ))}
            </div>
            {proveedor === "otro" && (
              <input
                type="text"
                value={proveedorCustom}
                onChange={(e) => setProveedorCustom(e.target.value)}
                placeholder="Nombre del proveedor..."
                className="mt-2 w-full border-2 border-stone-900 bg-white p-2 text-xs focus:outline-none focus:bg-amber-50 font-mono"
                autoFocus
              />
            )}
          </div>

          <div className="flex gap-2 pt-2 border-t-2 border-stone-200">
            <button onClick={onCancelar}
                    className="flex-1 text-[10px] font-bold tracking-widest p-3 border-2 border-stone-900 bg-white hover:bg-stone-100">
              CANCELAR
            </button>
            <button onClick={handleAñadir}
                    disabled={!puedeAñadir}
                    className={`flex-[2] text-xs font-black tracking-widest p-3 border-2 border-stone-900 transition-all ${
                      puedeAñadir
                        ? "bg-stone-900 text-amber-400 hover:bg-amber-400 hover:text-stone-900"
                        : "bg-stone-200 text-stone-400 cursor-not-allowed"
                    }`}
                    style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>
              ✓ AÑADIR AL PEDIDO
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// =========================================================
//  PANEL ADMIN — acceso con PIN, gestión completa
// =========================================================

// Hook simple para llamar a la API admin con PIN
function useAdminApi(pin) {
  return {
    async get(path) {
      const r = await fetch(BACKEND_URL + path, { headers: { "X-Admin-Pin": pin } });
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    },
    async post(path, body) {
      const r = await fetch(BACKEND_URL + path, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Admin-Pin": pin },
        body: JSON.stringify(body || {})
      });
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    },
    async put(path, body) {
      const r = await fetch(BACKEND_URL + path, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "X-Admin-Pin": pin },
        body: JSON.stringify(body || {})
      });
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    },
    async del(path) {
      const r = await fetch(BACKEND_URL + path, {
        method: "DELETE",
        headers: { "X-Admin-Pin": pin }
      });
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    }
  };
}

// =========================================================
//  PANTALLA LOGIN ADMIN — pide PIN
// =========================================================
function PantallaLoginAdmin({ onLogin, onSalir }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [comprobando, setComprobando] = useState(false);

  const handleEntrar = async () => {
    if (pin.length < 4) return;
    setComprobando(true);
    setError("");
    try {
      const r = await fetch(BACKEND_URL + "/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin })
      });
      if (!r.ok) {
        setError("PIN incorrecto");
        setPin("");
      } else {
        onLogin(pin);
      }
    } catch (e) {
      setError("Error de conexión");
    } finally {
      setComprobando(false);
    }
  };

  const teclaNumero = (n) => {
    if (pin.length < 8) setPin(pin + n);
  };
  const borrarUlt = () => setPin(pin.slice(0, -1));

  return (
    <div className="min-h-screen bg-stone-900 flex items-center justify-center p-4 font-mono"
         style={{ backgroundImage: "repeating-linear-gradient(45deg, transparent, transparent 30px, rgba(255,255,255,0.02) 30px, rgba(255,255,255,0.02) 31px)" }}>
      <div className="w-full max-w-sm">
        <div className="bg-red-600 border-4 border-stone-900 p-4 mb-3 shadow-[8px_8px_0_0_rgba(0,0,0,1)] text-white">
          <div className="text-[10px] tracking-[0.3em] mb-2">ARA CORPORATE</div>
          <h1 className="font-black text-3xl leading-none" style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>
            ACCESO ADMIN 🔐
          </h1>
        </div>

        <div className="bg-stone-800 border-4 border-stone-900 p-5 shadow-[8px_8px_0_0_rgba(0,0,0,1)] space-y-4">
          <div className="text-amber-400 text-xs tracking-widest font-bold">INTRODUCE PIN</div>

          {/* Display PIN */}
          <div className="bg-stone-900 border-2 border-amber-500 p-4 flex justify-center gap-3">
            {[0,1,2,3,4,5,6,7].slice(0, Math.max(4, pin.length)).map(i => (
              <div key={i} className={`w-3 h-3 rounded-full transition-all ${i < pin.length ? "bg-amber-400" : "bg-stone-700"}`} />
            ))}
          </div>

          {error && <div className="text-red-400 text-xs font-bold text-center">{error}</div>}

          {/* Teclado numérico */}
          <div className="grid grid-cols-3 gap-2">
            {[1,2,3,4,5,6,7,8,9].map(n => (
              <button key={n} onClick={() => teclaNumero(String(n))}
                      className="bg-stone-700 hover:bg-amber-500 hover:text-stone-900 text-amber-400 text-2xl font-black p-4 border-2 border-stone-900 transition-all"
                      style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>
                {n}
              </button>
            ))}
            <button onClick={borrarUlt}
                    className="bg-stone-700 hover:bg-red-600 text-amber-400 text-sm font-bold p-4 border-2 border-stone-900 transition-all">
              ←
            </button>
            <button onClick={() => teclaNumero("0")}
                    className="bg-stone-700 hover:bg-amber-500 hover:text-stone-900 text-amber-400 text-2xl font-black p-4 border-2 border-stone-900 transition-all"
                    style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>
              0
            </button>
            <button onClick={handleEntrar}
                    disabled={pin.length < 4 || comprobando}
                    className={`text-xs font-black tracking-widest p-4 border-2 border-stone-900 transition-all ${
                      pin.length >= 4 && !comprobando
                        ? "bg-amber-500 text-stone-900 hover:bg-amber-400"
                        : "bg-stone-700 text-stone-500 cursor-not-allowed"
                    }`}
                    style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>
              {comprobando ? "..." : "OK"}
            </button>
          </div>

          <button onClick={onSalir}
                  className="w-full text-stone-400 text-[10px] tracking-widest p-2 hover:text-amber-400">
            ← VOLVER A APP OPERARIO
          </button>
        </div>
      </div>
    </div>
  );
}

// =========================================================
//  PANEL ADMIN PRINCIPAL — todas las pestañas
// =========================================================
function PanelAdmin({ pin, onSalir }) {
  const api = useAdminApi(pin);
  const [data, setData] = useState(null);
  const [pestaña, setPestaña] = useState("resumen");
  const [recargando, setRecargando] = useState(false);

  // Carga TODA la BBDD admin
  const recargarTodo = async () => {
    setRecargando(true);
    try {
      const all = await api.get("/admin/all");
      setData(all);
    } catch (e) {
      console.error(e);
    } finally {
      setRecargando(false);
    }
  };

  useEffect(() => { recargarTodo(); }, []);

  if (!data) {
    return (
      <div className="min-h-screen bg-stone-100 flex items-center justify-center font-mono">
        <div className="text-stone-500 text-sm">Cargando datos del sistema…</div>
      </div>
    );
  }

  const pestañas = [
    { id: "resumen",   nombre: "RESUMEN",  icon: "📊" },
    { id: "productos", nombre: "PRODUCTOS", icon: "📦" },
    { id: "obras",     nombre: "OBRAS",    icon: "🏗" },
    { id: "operarios", nombre: "OPERARIOS", icon: "👷" },
    { id: "pedidos",   nombre: "PEDIDOS",  icon: "📋" },
    { id: "config",    nombre: "CONFIG",   icon: "⚙️" },
  ];

  return (
    <div className="min-h-screen bg-stone-100 font-mono"
         style={{ backgroundImage: "repeating-linear-gradient(45deg, transparent, transparent 30px, rgba(0,0,0,0.02) 30px, rgba(0,0,0,0.02) 31px)" }}>

      {/* Header */}
      <header className="bg-stone-900 border-b-4 border-amber-500 sticky top-0 z-30 shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="text-amber-400">
            <div className="text-[9px] tracking-widest opacity-70">ARA CORPORATE</div>
            <h1 className="font-black text-lg leading-none" style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>
              PANEL ADMIN 🔐
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={recargarTodo}
                    disabled={recargando}
                    className="bg-amber-500 text-stone-900 px-3 py-2 text-xs font-bold tracking-widest border-2 border-amber-500 hover:bg-amber-400 transition-all">
              {recargando ? "…" : "↻ RECARGAR"}
            </button>
            <button onClick={onSalir}
                    className="bg-red-600 text-white px-3 py-2 text-xs font-bold tracking-widest border-2 border-red-600 hover:bg-red-700 transition-all">
              SALIR
            </button>
          </div>
        </div>
        {/* Pestañas */}
        <div className="bg-stone-800 border-t-2 border-stone-700">
          <div className="max-w-7xl mx-auto px-4 flex gap-0 overflow-x-auto">
            {pestañas.map(p => (
              <button key={p.id} onClick={() => setPestaña(p.id)}
                      className={`shrink-0 px-4 py-3 text-xs font-bold tracking-widest transition-all border-r-2 border-stone-700 ${
                        pestaña === p.id
                          ? "bg-amber-500 text-stone-900"
                          : "text-amber-400 hover:bg-stone-700"
                      }`}>
                <span className="mr-1">{p.icon}</span>{p.nombre}
                {p.id === "resumen" && (data.productosPendientes?.filter(x => x.estado === "pendiente").length > 0 || data.obrasPendientes?.length > 0) && (
                  <span className="ml-1 bg-red-600 text-white text-[9px] px-1.5 py-0.5 rounded-full">!</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-4">
        {pestaña === "resumen"   && <PestañaResumen data={data} api={api} reload={recargarTodo} setPestaña={setPestaña} />}
        {pestaña === "productos" && <PestañaProductos data={data} api={api} reload={recargarTodo} />}
        {pestaña === "obras"     && <PestañaObras data={data} api={api} reload={recargarTodo} />}
        {pestaña === "operarios" && <PestañaOperarios data={data} api={api} reload={recargarTodo} />}
        {pestaña === "pedidos"   && <PestañaPedidos data={data} />}
        {pestaña === "config"    && <PestañaConfig data={data} api={api} reload={recargarTodo} pin={pin} onSalir={onSalir} />}
      </div>
    </div>
  );
}

// =========================================================
//  PESTAÑA RESUMEN
// =========================================================
function PestañaResumen({ data, api, reload, setPestaña }) {
  const pendientes = (data.productosPendientes || []).filter(p => p.estado === "pendiente");
  const obrasPend = data.obrasPendientes || [];
  const pedidos = data.pedidos || [];

  // Calcular pedidos esta semana
  const ahora = new Date();
  const haceSiete = new Date(ahora.getTime() - 7 * 24 * 60 * 60 * 1000);
  const pedidosSemana = pedidos.filter(p => new Date(p.fecha) >= haceSiete);
  const totalSemAqua = pedidosSemana.reduce((s, p) => s + (p.lineasAqua || []).reduce((a, l) => a + (l.importe || 0), 0), 0);
  const totalSemAram = pedidosSemana.reduce((s, p) => s + (p.lineasAram || []).reduce((a, l) => a + (l.importe || 0), 0), 0);

  // Productos más pedidos (top 5)
  const contador = {};
  pedidos.forEach(p => {
    [...(p.lineasAqua || []), ...(p.lineasAram || [])].forEach(l => {
      const k = l.desc;
      contador[k] = (contador[k] || 0) + l.cantidad;
    });
  });
  const topProductos = Object.entries(contador).sort((a, b) => b[1] - a[1]).slice(0, 5);

  return (
    <div className="space-y-4">
      {/* Pendientes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border-2 border-stone-900 shadow-[4px_4px_0_0_rgba(0,0,0,1)]">
          <div className="bg-amber-500 border-b-2 border-stone-900 p-3 flex items-center justify-between">
            <div className="font-black tracking-wider" style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>
              🆕 PRODUCTOS NO LISTADOS
            </div>
            <span className="bg-stone-900 text-amber-400 text-xs px-2 py-0.5 font-bold">{pendientes.length}</span>
          </div>
          <div className="p-3 max-h-64 overflow-y-auto">
            {pendientes.length === 0 ? (
              <div className="text-xs text-stone-500 italic text-center py-4">Sin solicitudes pendientes</div>
            ) : (
              <div className="space-y-2">
                {pendientes.slice(0, 5).map(p => (
                  <div key={p.id} className="border-2 border-stone-200 p-2 text-xs">
                    <div className="font-bold">{p.desc}</div>
                    <div className="text-[10px] text-stone-500 mt-0.5">
                      {p.cantidad} {p.unidad} · {p.pedidoPor} · {p.obra?.nombre || "—"}
                    </div>
                  </div>
                ))}
                {pendientes.length > 5 && (
                  <button onClick={() => setPestaña("productos")} className="w-full text-xs font-bold text-stone-700 underline">
                    Ver todos ({pendientes.length}) →
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white border-2 border-stone-900 shadow-[4px_4px_0_0_rgba(0,0,0,1)]">
          <div className="bg-amber-500 border-b-2 border-stone-900 p-3 flex items-center justify-between">
            <div className="font-black tracking-wider" style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>
              🏗 OBRAS NUEVAS
            </div>
            <span className="bg-stone-900 text-amber-400 text-xs px-2 py-0.5 font-bold">{obrasPend.length}</span>
          </div>
          <div className="p-3 max-h-64 overflow-y-auto">
            {obrasPend.length === 0 ? (
              <div className="text-xs text-stone-500 italic text-center py-4">Sin obras nuevas pendientes</div>
            ) : (
              <div className="space-y-2">
                {obrasPend.slice(0, 5).map(o => (
                  <div key={o.id} className="border-2 border-stone-200 p-2 text-xs">
                    <div className="font-bold">{o.nombre}</div>
                    <div className="text-[10px] text-stone-500 mt-0.5">
                      {o.dir || "Sin dirección"} · creada por {o.creadaPor}
                    </div>
                  </div>
                ))}
                {obrasPend.length > 5 && (
                  <button onClick={() => setPestaña("obras")} className="w-full text-xs font-bold text-stone-700 underline">
                    Ver todas ({obrasPend.length}) →
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stats semana */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard titulo="PEDIDOS 7D" valor={pedidosSemana.length} sub="esta semana" />
        <StatCard titulo="GASTO 7D AQUA" valor={"€" + totalSemAqua.toFixed(0)} sub={`base imp. (€${(totalSemAqua * 1.21).toFixed(0)} c/IVA)`} color="emerald" />
        <StatCard titulo="GASTO 7D ARAM" valor={"€" + totalSemAram.toFixed(0)} sub={`base imp. (€${(totalSemAram * 1.21).toFixed(0)} c/IVA)`} color="amber" />
        <StatCard titulo="TOTAL PEDIDOS" valor={pedidos.length} sub="histórico" />
      </div>

      {/* Top productos */}
      {topProductos.length > 0 && (
        <div className="bg-white border-2 border-stone-900 shadow-[4px_4px_0_0_rgba(0,0,0,1)]">
          <div className="bg-stone-900 text-amber-400 border-b-2 border-stone-900 p-3 font-black tracking-wider"
               style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>
            🏆 PRODUCTOS MÁS PEDIDOS
          </div>
          <div className="divide-y-2 divide-stone-100">
            {topProductos.map(([desc, cant], i) => (
              <div key={desc} className="p-3 flex items-center gap-3">
                <div className="w-8 text-xl font-black text-amber-500">#{i + 1}</div>
                <div className="flex-1 text-xs font-bold">{desc}</div>
                <div className="text-sm font-mono">{cant}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ titulo, valor, sub, color }) {
  const bg = color === "emerald" ? "bg-emerald-50 border-emerald-700" :
             color === "amber" ? "bg-amber-50 border-amber-700" :
             "bg-white border-stone-900";
  return (
    <div className={`border-2 ${bg} p-3 shadow-[4px_4px_0_0_rgba(0,0,0,1)]`}>
      <div className="text-[10px] tracking-widest text-stone-500 mb-1">{titulo}</div>
      <div className="font-black text-2xl text-stone-900" style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>{valor}</div>
      <div className="text-[10px] text-stone-500 mt-1">{sub}</div>
    </div>
  );
}

// =========================================================
//  PESTAÑA PRODUCTOS — gestión catálogo + validar pendientes
// =========================================================
function PestañaProductos({ data, api, reload }) {
  const [editando, setEditando] = useState(null); // producto que se está editando
  const [añadiendo, setAñadiendo] = useState(false);
  const [busq, setBusq] = useState("");
  const [validando, setValidando] = useState(null); // pendiente que se valida
  const [modalImportar, setModalImportar] = useState(false);

  const productos = (data.productos || []).filter(p =>
    busq === "" ||
    p.desc.toLowerCase().includes(busq.toLowerCase()) ||
    (p.proveedores?.aqua?.ref || "").toLowerCase().includes(busq.toLowerCase()) ||
    (p.proveedores?.aram?.ref || "").toLowerCase().includes(busq.toLowerCase())
  );

  const pendientes = (data.productosPendientes || []).filter(p => p.estado === "pendiente");

  const handleBorrar = async (id) => {
    if (!confirm("¿Borrar este producto del catálogo? No afecta a pedidos ya hechos.")) return;
    await api.del("/admin/producto/" + id);
    reload();
  };

  return (
    <div className="space-y-4">
      {/* Productos pendientes de validar */}
      {pendientes.length > 0 && (
        <div className="bg-amber-100 border-2 border-amber-700 p-3">
          <div className="font-bold text-sm text-amber-900 mb-2">
            🆕 {pendientes.length} producto{pendientes.length>1?"s":""} no listado{pendientes.length>1?"s":""} pedido{pendientes.length>1?"s":""} por operarios
          </div>
          <div className="space-y-2">
            {pendientes.map(p => (
              <div key={p.id} className="bg-white border border-amber-700 p-2 flex items-start justify-between gap-2 text-xs">
                <div className="flex-1">
                  <div className="font-bold">{p.desc}</div>
                  <div className="text-[10px] text-stone-500 mt-0.5">
                    {p.cantidad} {p.unidad} · pedido por {p.pedidoPor} · obra: {p.obra?.nombre || "—"}
                    {p.proveedor !== "indistinto" && <> · prefiere <strong>{p.proveedor === "aqua" ? "Aquatubo" : "Aramburu"}</strong></>}
                  </div>
                </div>
                <button onClick={() => setValidando(p)}
                        className="text-[10px] font-bold bg-emerald-700 text-white px-2 py-1 border border-stone-900 hover:bg-emerald-800">
                  ✓ AÑADIR AL CATÁLOGO
                </button>
                <button onClick={async () => {
                          if (!confirm("¿Descartar esta solicitud sin añadirla al catálogo?")) return;
                          await api.post("/admin/pendiente/" + p.id + "/descartar");
                          reload();
                        }}
                        className="text-[10px] font-bold bg-stone-200 text-stone-900 px-2 py-1 border border-stone-900 hover:bg-stone-300">
                  ✗
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Buscador + botones */}
      <div className="space-y-2">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input type="text" placeholder="Buscar por descripción o referencia…"
                   value={busq} onChange={(e) => setBusq(e.target.value)}
                   className="w-full pl-10 pr-3 py-2 border-2 border-stone-900 bg-white text-sm focus:outline-none focus:bg-amber-50 font-mono" />
          </div>
          <button onClick={() => setAñadiendo(true)}
                  className="bg-stone-900 text-amber-400 px-4 py-2 text-xs font-black tracking-widest border-2 border-stone-900 hover:bg-amber-400 hover:text-stone-900"
                  style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>
            + NUEVO
          </button>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setModalImportar(true)}
                  className="text-[10px] font-bold tracking-widest px-3 py-1.5 border-2 border-stone-900 bg-emerald-100 hover:bg-emerald-200 text-stone-900">
            📥 IMPORTAR
          </button>
          <button onClick={() => exportarCSV(data.productos)}
                  className="text-[10px] font-bold tracking-widest px-3 py-1.5 border-2 border-stone-900 bg-amber-100 hover:bg-amber-200 text-stone-900">
            📤 EXPORTAR CSV
          </button>
          <button onClick={() => exportarJSON(data.productos)}
                  className="text-[10px] font-bold tracking-widest px-3 py-1.5 border-2 border-stone-900 bg-amber-100 hover:bg-amber-200 text-stone-900">
            📤 EXPORTAR JSON
          </button>
          <button onClick={() => descargarPlantillaCSV()}
                  className="text-[10px] font-bold tracking-widest px-3 py-1.5 border-2 border-stone-900 bg-stone-100 hover:bg-stone-200 text-stone-900">
            📋 PLANTILLA CSV
          </button>
        </div>
      </div>

      <div className="text-[10px] text-stone-500 tracking-widest">
        {productos.length} de {data.productos.length} productos
      </div>

      {/* Tabla productos */}
      <div className="bg-white border-2 border-stone-900 overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-stone-900 text-amber-400">
            <tr>
              <th className="p-2 text-left">FAMILIA</th>
              <th className="p-2 text-left">DESCRIPCIÓN</th>
              <th className="p-2 text-left">REF AQUA</th>
              <th className="p-2 text-right">€ AQUA</th>
              <th className="p-2 text-left">REF ARAM</th>
              <th className="p-2 text-right">€ ARAM</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-200">
            {productos.slice(0, 100).map(p => {
              const aq = p.proveedores?.aqua;
              const ar = p.proveedores?.aram;
              const netoA = aq ? +(aq.bruto * (1 - aq.dto / 100)).toFixed(2) : null;
              const netoR = ar ? +(ar.bruto * (1 - ar.dto / 100)).toFixed(2) : null;
              return (
                <tr key={p.id} className="hover:bg-amber-50">
                  <td className="p-2 text-[10px] text-stone-500">{p.familia}</td>
                  <td className="p-2 font-bold">{p.desc}</td>
                  <td className="p-2 font-mono text-[10px]">{aq?.ref || "—"}</td>
                  <td className="p-2 text-right font-mono">{netoA ? "€" + netoA : "—"}</td>
                  <td className="p-2 font-mono text-[10px]">{ar?.ref || "—"}</td>
                  <td className="p-2 text-right font-mono">{netoR ? "€" + netoR : "—"}</td>
                  <td className="p-2 text-right whitespace-nowrap">
                    <button onClick={() => setEditando(p)}
                            className="text-[10px] font-bold bg-amber-500 text-stone-900 px-2 py-1 border border-stone-900 hover:bg-amber-400 mr-1">
                      ✏ EDITAR
                    </button>
                    <button onClick={() => handleBorrar(p.id)}
                            className="text-[10px] font-bold bg-red-600 text-white px-2 py-1 border border-stone-900 hover:bg-red-700">
                      🗑
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {productos.length > 100 && (
          <div className="p-3 text-xs text-stone-500 text-center bg-stone-50">
            Mostrando los primeros 100 de {productos.length}. Usa el buscador para filtrar.
          </div>
        )}
      </div>

      {/* Modales */}
      {editando && (
        <ModalEditarProducto producto={editando} api={api} reload={reload} onCerrar={() => setEditando(null)} />
      )}
      {añadiendo && (
        <ModalEditarProducto producto={null} api={api} reload={reload} onCerrar={() => setAñadiendo(false)} />
      )}
      {validando && (
        <ModalEditarProducto
          producto={null}
          api={api}
          reload={reload}
          onCerrar={() => setValidando(null)}
          plantillaInicial={{
            desc: validando.desc,
            familia: "Varios",
            unidad: validando.unidad,
            img: "tapon"
          }}
          esValidacion={validando}
        />
      )}
      {modalImportar && (
        <ModalImportarProductos
          productosActuales={data.productos || []}
          api={api}
          reload={reload}
          onCerrar={() => setModalImportar(false)}
        />
      )}
    </div>
  );
}

// =========================================================
//  IMPORTAR / EXPORTAR PRODUCTOS — funciones helper
// =========================================================

// Cabeceras del CSV en orden
const CSV_HEADERS = [
  "id", "desc", "familia", "unidad", "img",
  "aqua_ref", "aqua_bruto", "aqua_dto", "aqua_marca",
  "aram_ref", "aram_bruto", "aram_dto", "aram_marca"
];

// Escapa una celda CSV: si tiene coma, comillas o salto de línea → entrecomillar
function csvEscape(v) {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes(";")) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

// Genera el contenido CSV completo a partir de un array de productos
function generarCSV(productos) {
  const filas = [CSV_HEADERS.join(",")];
  for (const p of productos) {
    const aq = p.proveedores?.aqua || {};
    const ar = p.proveedores?.aram || {};
    const fila = [
      csvEscape(p.id || ""),
      csvEscape(p.desc || ""),
      csvEscape(p.familia || ""),
      csvEscape(p.unidad || ""),
      csvEscape(p.img || ""),
      csvEscape(aq.ref || ""),
      csvEscape(aq.bruto ?? ""),
      csvEscape(aq.dto ?? ""),
      csvEscape(aq.marca || ""),
      csvEscape(ar.ref || ""),
      csvEscape(ar.bruto ?? ""),
      csvEscape(ar.dto ?? ""),
      csvEscape(ar.marca || "")
    ];
    filas.push(fila.join(","));
  }
  // BOM UTF-8 para que Excel lo abra bien con acentos
  return "\ufeff" + filas.join("\n");
}

// Descarga un blob como archivo
function descargarArchivo(contenido, nombre, tipoMime) {
  const blob = new Blob([contenido], { type: tipoMime + ";charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportarCSV(productos) {
  const contenido = generarCSV(productos);
  const fecha = new Date().toISOString().slice(0, 10);
  descargarArchivo(contenido, `ARA_productos_${fecha}.csv`, "text/csv");
}

function exportarJSON(productos) {
  const contenido = JSON.stringify(productos, null, 2);
  const fecha = new Date().toISOString().slice(0, 10);
  descargarArchivo(contenido, `ARA_productos_${fecha}.json`, "application/json");
}

function descargarPlantillaCSV() {
  // Plantilla con cabeceras + 2 filas de ejemplo
  const ejemplo = [
    {
      id: "", // si vacío se generará automáticamente
      desc: "Ejemplo: codo multicapa 25",
      familia: "Multicapa",
      unidad: "uni",
      img: "mcap",
      proveedores: {
        aqua: { ref: "25742", bruto: 10.82, dto: 73, marca: "MT" },
        aram: { ref: "MCCDO25", bruto: 7.45, dto: 50, marca: "FE" }
      }
    },
    {
      id: "",
      desc: "Ejemplo: producto solo en Aramburu (deja vacíos los campos aqua_*)",
      familia: "Varios",
      unidad: "uni",
      img: "tapon",
      proveedores: {
        aram: { ref: "REF123", bruto: 5.50, dto: 50, marca: "—" }
      }
    }
  ];
  const contenido = generarCSV(ejemplo);
  descargarArchivo(contenido, "ARA_plantilla_productos.csv", "text/csv");
}

// Parser CSV simple que respeta comillas y comas dentro de campos
function parsearCSV(texto) {
  // Quitar BOM si existe
  if (texto.charCodeAt(0) === 0xFEFF) texto = texto.slice(1);

  const filas = [];
  let fila = [];
  let celda = "";
  let dentroDeComillas = false;
  let i = 0;

  while (i < texto.length) {
    const c = texto[i];
    if (dentroDeComillas) {
      if (c === '"') {
        if (texto[i + 1] === '"') { celda += '"'; i += 2; continue; } // comilla escapada
        dentroDeComillas = false;
        i++;
        continue;
      }
      celda += c;
      i++;
    } else {
      if (c === '"') { dentroDeComillas = true; i++; continue; }
      if (c === ',' || c === ';') { fila.push(celda); celda = ""; i++; continue; }
      if (c === '\n' || c === '\r') {
        // Cierra fila
        if (c === '\r' && texto[i+1] === '\n') i++; // CRLF
        fila.push(celda);
        if (fila.length > 1 || fila[0] !== "") filas.push(fila);
        fila = [];
        celda = "";
        i++;
        continue;
      }
      celda += c;
      i++;
    }
  }
  if (celda !== "" || fila.length > 0) {
    fila.push(celda);
    filas.push(fila);
  }
  return filas;
}

// Convierte filas CSV (con cabeceras en la primera fila) a un array de productos
function csvAProductos(filas) {
  if (filas.length < 2) throw new Error("El archivo está vacío o no tiene datos");
  const cabeceras = filas[0].map(h => h.trim().toLowerCase());

  // Validar que están las cabeceras mínimas
  const obligatorias = ["desc", "familia"];
  const faltan = obligatorias.filter(h => !cabeceras.includes(h));
  if (faltan.length > 0) {
    throw new Error("Faltan columnas obligatorias: " + faltan.join(", "));
  }

  const idx = (nombre) => cabeceras.indexOf(nombre);

  const productos = [];
  const errores = [];

  for (let i = 1; i < filas.length; i++) {
    const fila = filas[i];
    if (fila.every(c => !c.trim())) continue; // fila vacía, ignorar

    const get = (col) => {
      const j = idx(col);
      return j < 0 ? "" : (fila[j] || "").trim();
    };
    const getNum = (col) => {
      const v = get(col);
      if (v === "") return null;
      const n = parseFloat(v.replace(",", "."));
      return isNaN(n) ? null : n;
    };

    const desc = get("desc");
    if (!desc) {
      errores.push({ linea: i + 1, error: "Sin descripción" });
      continue;
    }

    const p = {
      id: get("id") || null,
      desc,
      familia: get("familia") || "Varios",
      unidad: get("unidad") || "uni",
      img: get("img") || "tapon",
      proveedores: {}
    };

    // Aquatubo
    const aqRef = get("aqua_ref");
    const aqBruto = getNum("aqua_bruto");
    if (aqRef && aqBruto !== null) {
      p.proveedores.aqua = {
        ref: aqRef,
        bruto: aqBruto,
        dto: getNum("aqua_dto") ?? 0,
        marca: get("aqua_marca") || "—"
      };
    }
    // Aramburu
    const arRef = get("aram_ref");
    const arBruto = getNum("aram_bruto");
    if (arRef && arBruto !== null) {
      p.proveedores.aram = {
        ref: arRef,
        bruto: arBruto,
        dto: getNum("aram_dto") ?? 0,
        marca: get("aram_marca") || "—"
      };
    }

    if (!p.proveedores.aqua && !p.proveedores.aram) {
      errores.push({ linea: i + 1, error: `"${desc}" sin precios de ningún proveedor` });
      continue;
    }

    productos.push(p);
  }

  return { productos, errores };
}

// =========================================================
//  Modal importar productos
// =========================================================
function ModalImportarProductos({ productosActuales, api, reload, onCerrar }) {
  const [archivo, setArchivo] = useState(null);
  const [analisis, setAnalisis] = useState(null); // { coinciden, nuevos, faltan, errores }
  const [accionFaltan, setAccionFaltan] = useState("mantener"); // mantener | borrar
  const [aplicando, setAplicando] = useState(false);
  const [error, setError] = useState("");
  const [progreso, setProgreso] = useState(null);

  const handleArchivo = async (e) => {
    setError("");
    setAnalisis(null);
    const f = e.target.files?.[0];
    if (!f) return;
    setArchivo(f);

    try {
      const texto = await f.text();
      let importados, errores;

      // Detectar JSON o CSV por extensión y contenido
      const esJSON = f.name.toLowerCase().endsWith(".json") || texto.trim().startsWith("[") || texto.trim().startsWith("{");

      if (esJSON) {
        let data;
        try {
          data = JSON.parse(texto);
        } catch (er) {
          throw new Error("JSON mal formado: " + er.message);
        }
        const arr = Array.isArray(data) ? data : (data.productos || []);
        importados = arr.filter(p => p && p.desc);
        errores = arr.filter(p => !p?.desc).map((p, i) => ({ linea: i + 1, error: "Sin descripción" }));
      } else {
        // CSV
        const filas = parsearCSV(texto);
        const r = csvAProductos(filas);
        importados = r.productos;
        errores = r.errores;
      }

      // Comparar con productosActuales
      const idsActuales = new Set(productosActuales.map(p => p.id));
      const descsActuales = new Map(productosActuales.map(p => [p.desc.toLowerCase().trim(), p.id]));
      const idsImportados = new Set();

      const coinciden = []; // van a actualizarse
      const nuevos = [];

      for (const p of importados) {
        // Si trae id que existe → actualizar
        if (p.id && idsActuales.has(p.id)) {
          coinciden.push(p);
          idsImportados.add(p.id);
        } else {
          // Si no trae id pero hay coincidencia por descripción exacta → actualizar
          const idEncontrado = descsActuales.get(p.desc.toLowerCase().trim());
          if (idEncontrado) {
            coinciden.push({ ...p, id: idEncontrado });
            idsImportados.add(idEncontrado);
          } else {
            nuevos.push(p);
          }
        }
      }

      // Productos en el catálogo actual que NO están en el CSV
      const faltan = productosActuales.filter(p => !idsImportados.has(p.id));

      setAnalisis({ coinciden, nuevos, faltan, errores });
    } catch (e) {
      setError(e.message);
      setAnalisis(null);
    }
  };

  const aplicarCambios = async () => {
    if (!analisis) return;
    setAplicando(true);
    setError("");
    let n = 0;
    const total = analisis.coinciden.length + analisis.nuevos.length + (accionFaltan === "borrar" ? analisis.faltan.length : 0);
    setProgreso({ hechos: 0, total });

    try {
      // 1) Actualizar coincidencias
      for (const p of analisis.coinciden) {
        await api.put("/admin/producto/" + p.id, {
          desc: p.desc, familia: p.familia, unidad: p.unidad, img: p.img,
          proveedores: p.proveedores
        });
        n++; setProgreso({ hechos: n, total });
      }
      // 2) Crear nuevos
      for (const p of analisis.nuevos) {
        const body = { desc: p.desc, familia: p.familia, unidad: p.unidad, img: p.img, proveedores: p.proveedores };
        if (p.id) body.id = p.id;
        await api.post("/admin/producto", body);
        n++; setProgreso({ hechos: n, total });
      }
      // 3) Borrar los que faltan (si así se decidió)
      if (accionFaltan === "borrar") {
        for (const p of analisis.faltan) {
          await api.del("/admin/producto/" + p.id);
          n++; setProgreso({ hechos: n, total });
        }
      }

      reload();
      alert(`✓ Importación completada:
  • ${analisis.coinciden.length} actualizados
  • ${analisis.nuevos.length} añadidos
  • ${accionFaltan === "borrar" ? analisis.faltan.length + " borrados" : analisis.faltan.length + " mantenidos sin cambios"}`);
      onCerrar();
    } catch (e) {
      setError("Error aplicando cambios: " + e.message + ". Algunos productos pueden haberse actualizado, otros no.");
    } finally {
      setAplicando(false);
      setProgreso(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-stone-900/50" onClick={!aplicando ? onCerrar : undefined} />
      <div className="relative bg-white border-4 border-stone-900 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-[8px_8px_0_0_rgba(0,0,0,1)]">
        <div className="bg-emerald-500 border-b-4 border-stone-900 p-3 flex items-center justify-between sticky top-0 z-10">
          <h3 className="font-black text-base" style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>
            📥 IMPORTAR PRODUCTOS
          </h3>
          <button onClick={onCerrar} disabled={aplicando}
                  className="bg-stone-900 text-amber-400 p-1.5 border-2 border-stone-900 disabled:opacity-50">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <div className="bg-stone-50 border-2 border-stone-300 p-3 text-xs leading-relaxed">
            <div className="font-bold mb-1">Sube un archivo CSV o JSON con tus productos.</div>
            <div className="text-[10px] text-stone-600">
              · Formato CSV con cabeceras: <code className="bg-stone-200 px-1">id, desc, familia, unidad, img, aqua_ref, aqua_bruto, aqua_dto, aqua_marca, aram_ref, aram_bruto, aram_dto, aram_marca</code>
              <br />· Si un producto tiene <strong>id</strong> que ya existe en tu catálogo → se actualizará
              <br />· Si no hay <strong>id</strong> pero la descripción coincide → se actualizará
              <br />· Productos nuevos se añaden automáticamente
              <br />· Si quieres una plantilla, descarga la plantilla CSV desde el botón anterior
            </div>
          </div>

          {/* Selector archivo */}
          <div>
            <label className="block w-full border-2 border-dashed border-stone-900 p-6 text-center cursor-pointer hover:bg-amber-50 transition-all">
              <input type="file" accept=".csv,.json,text/csv,application/json"
                     onChange={handleArchivo}
                     disabled={aplicando}
                     className="hidden" />
              <div className="text-2xl mb-1">📁</div>
              <div className="text-xs font-bold tracking-widest">
                {archivo ? archivo.name : "SELECCIONAR ARCHIVO CSV/JSON"}
              </div>
            </label>
          </div>

          {error && (
            <div className="bg-red-100 border-2 border-red-700 text-red-900 p-3 text-xs">
              ⚠ {error}
            </div>
          )}

          {/* Análisis */}
          {analisis && (
            <div className="space-y-3">
              <div className="border-2 border-stone-900">
                <div className="bg-stone-900 text-amber-400 p-2 text-xs font-bold tracking-widest">
                  📊 ANÁLISIS DEL ARCHIVO
                </div>
                <div className="divide-y divide-stone-200">
                  {analisis.coinciden.length > 0 && (
                    <div className="p-2 flex items-center gap-2 text-xs">
                      <span className="text-emerald-700 text-base">✏</span>
                      <span><strong>{analisis.coinciden.length}</strong> producto(s) ya existen en tu catálogo — <strong>se ACTUALIZARÁN</strong></span>
                    </div>
                  )}
                  {analisis.nuevos.length > 0 && (
                    <div className="p-2 flex items-center gap-2 text-xs">
                      <span className="text-amber-700 text-base">🆕</span>
                      <span><strong>{analisis.nuevos.length}</strong> producto(s) nuevos — <strong>se AÑADIRÁN</strong></span>
                    </div>
                  )}
                  {analisis.faltan.length > 0 && (
                    <div className="p-2 text-xs">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-stone-700 text-base">⚠</span>
                        <span><strong>{analisis.faltan.length}</strong> producto(s) están en tu catálogo pero NO en el archivo:</span>
                      </div>
                      <div className="ml-7 space-y-1">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="radio" name="faltan" checked={accionFaltan === "mantener"}
                                 onChange={() => setAccionFaltan("mantener")} />
                          <span><strong>Mantener</strong> sin cambios (recomendado)</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="radio" name="faltan" checked={accionFaltan === "borrar"}
                                 onChange={() => setAccionFaltan("borrar")} />
                          <span className="text-red-700"><strong>Borrar</strong> del catálogo (¡cuidado!)</span>
                        </label>
                      </div>
                    </div>
                  )}
                  {analisis.errores.length > 0 && (
                    <div className="p-2 bg-red-50 text-xs">
                      <div className="font-bold text-red-900 mb-1">⚠ {analisis.errores.length} fila(s) con errores (se ignorarán):</div>
                      <div className="ml-3 space-y-0.5 max-h-24 overflow-y-auto">
                        {analisis.errores.slice(0, 10).map((e, i) => (
                          <div key={i} className="text-red-800">• Línea {e.linea}: {e.error}</div>
                        ))}
                        {analisis.errores.length > 10 && (
                          <div className="italic">…y {analisis.errores.length - 10} más</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Progreso */}
              {progreso && (
                <div className="bg-amber-100 border-2 border-amber-700 p-3 text-xs">
                  <div className="font-bold mb-1">Aplicando cambios… {progreso.hechos} / {progreso.total}</div>
                  <div className="w-full bg-amber-200 h-2">
                    <div className="bg-amber-700 h-full transition-all" style={{ width: (progreso.hechos / Math.max(1, progreso.total) * 100) + "%" }} />
                  </div>
                </div>
              )}

              {/* Botones */}
              <div className="flex gap-2 pt-2 border-t-2 border-stone-200">
                <button onClick={onCerrar} disabled={aplicando}
                        className="flex-1 text-xs font-bold tracking-widest p-3 border-2 border-stone-900 bg-white hover:bg-stone-100 disabled:opacity-50">
                  CANCELAR
                </button>
                <button onClick={aplicarCambios} disabled={aplicando || (analisis.coinciden.length === 0 && analisis.nuevos.length === 0 && (accionFaltan !== "borrar" || analisis.faltan.length === 0))}
                        className={`flex-[2] text-xs font-black tracking-widest p-3 border-2 border-stone-900 transition-all ${
                          aplicando ? "bg-stone-300 text-stone-600 cursor-wait"
                            : "bg-emerald-700 text-white hover:bg-emerald-800"
                        }`}
                        style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>
                  {aplicando ? "APLICANDO…" : "✓ APLICAR CAMBIOS"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Modal para crear/editar/validar producto
function ModalEditarProducto({ producto, api, reload, onCerrar, plantillaInicial, esValidacion }) {
  const inicial = producto || plantillaInicial || { desc: "", familia: "Varios", unidad: "uni", img: "tapon" };
  const [desc, setDesc] = useState(inicial.desc || "");
  const [familia, setFamilia] = useState(inicial.familia || "Varios");
  const [unidad, setUnidad] = useState(inicial.unidad || "uni");
  const [img, setImg] = useState(inicial.img || "tapon");

  const aq0 = inicial.proveedores?.aqua;
  const [aqRef, setAqRef] = useState(aq0?.ref || "");
  const [aqBruto, setAqBruto] = useState(aq0?.bruto || "");
  const [aqDto, setAqDto] = useState(aq0?.dto || "");
  const [aqMarca, setAqMarca] = useState(aq0?.marca || "—");

  const ar0 = inicial.proveedores?.aram;
  const [arRef, setArRef] = useState(ar0?.ref || "");
  const [arBruto, setArBruto] = useState(ar0?.bruto || "");
  const [arDto, setArDto] = useState(ar0?.dto || "");
  const [arMarca, setArMarca] = useState(ar0?.marca || "—");

  const [guardando, setGuardando] = useState(false);

  const handleGuardar = async () => {
    if (!desc.trim()) return alert("La descripción es obligatoria");
    setGuardando(true);
    try {
      const proveedores = {};
      if (aqRef && aqBruto) {
        proveedores.aqua = { ref: aqRef, bruto: parseFloat(aqBruto), dto: parseFloat(aqDto) || 0, marca: aqMarca };
      }
      if (arRef && arBruto) {
        proveedores.aram = { ref: arRef, bruto: parseFloat(arBruto), dto: parseFloat(arDto) || 0, marca: arMarca };
      }
      const body = { desc, familia, unidad, img, proveedores };

      if (esValidacion) {
        // Validar pendiente: crea producto y marca pendiente como validado
        await api.post("/admin/pendiente/" + esValidacion.id + "/validar", body);
      } else if (producto) {
        await api.put("/admin/producto/" + producto.id, body);
      } else {
        await api.post("/admin/producto", body);
      }
      reload();
      onCerrar();
    } catch (e) {
      alert("Error: " + e.message);
    } finally {
      setGuardando(false);
    }
  };

  const aqNeto = aqBruto ? +(parseFloat(aqBruto) * (1 - (parseFloat(aqDto) || 0) / 100)).toFixed(4) : null;
  const arNeto = arBruto ? +(parseFloat(arBruto) * (1 - (parseFloat(arDto) || 0) / 100)).toFixed(4) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-stone-900/50" onClick={onCerrar} />
      <div className="relative bg-white border-4 border-stone-900 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-[8px_8px_0_0_rgba(0,0,0,1)]">
        <div className="bg-amber-500 border-b-4 border-stone-900 p-3 flex items-center justify-between sticky top-0 z-10">
          <h3 className="font-black text-base" style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>
            {esValidacion ? "✓ VALIDAR Y AÑADIR" : producto ? "✏ EDITAR PRODUCTO" : "+ NUEVO PRODUCTO"}
          </h3>
          <button onClick={onCerrar} className="bg-stone-900 text-amber-400 p-1.5 border-2 border-stone-900">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <div>
            <label className="text-[10px] tracking-widest font-bold text-stone-700 mb-1 block">DESCRIPCIÓN</label>
            <input type="text" value={desc} onChange={(e) => setDesc(e.target.value)}
                   className="w-full border-2 border-stone-900 p-2 text-sm focus:bg-amber-50 focus:outline-none font-mono" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-[10px] tracking-widest font-bold text-stone-700 mb-1 block">FAMILIA</label>
              <select value={familia} onChange={(e) => setFamilia(e.target.value)}
                      className="w-full border-2 border-stone-900 p-2 text-xs focus:bg-amber-50 focus:outline-none font-mono">
                {FAMILIAS.filter(f => f.nombre !== "Todo").map(f => (
                  <option key={f.nombre} value={f.nombre}>{f.nombre}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] tracking-widest font-bold text-stone-700 mb-1 block">UNIDAD</label>
              <select value={unidad} onChange={(e) => setUnidad(e.target.value)}
                      className="w-full border-2 border-stone-900 p-2 text-xs focus:bg-amber-50 focus:outline-none font-mono">
                <option value="uni">unidades</option>
                <option value="m">metros</option>
                <option value="kg">kilos</option>
                <option value="L">litros</option>
                <option value="caja">caja</option>
                <option value="rollo">rollo</option>
                <option value="par">par</option>
                <option value="día">día</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] tracking-widest font-bold text-stone-700 mb-1 block">IMAGEN</label>
              <select value={img} onChange={(e) => setImg(e.target.value)}
                      className="w-full border-2 border-stone-900 p-2 text-xs focus:bg-amber-50 focus:outline-none font-mono">
                {["valvula","fitting","te","codo","machon","tapon","reduccion","filtro","tubo-pex","tubo-pe","tubo-pvc","te-pvc","codo-pvc","reduc-pvc","electro","cobre","mcap","bateria","latiguillo","aislamiento","abrazadera"].map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Aquatubo */}
          <div className="border-2 border-emerald-700 bg-emerald-50 p-3">
            <div className="font-black text-sm text-emerald-900 mb-2" style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>
              🟢 AQUATUBO {!aqRef && <span className="text-[10px] font-normal opacity-60">(opcional)</span>}
            </div>
            <div className="grid grid-cols-4 gap-2">
              <div>
                <label className="text-[10px] font-bold text-stone-700 mb-1 block">REF</label>
                <input type="text" value={aqRef} onChange={(e) => setAqRef(e.target.value)}
                       className="w-full border-2 border-stone-900 p-2 text-xs font-mono focus:bg-white focus:outline-none" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-stone-700 mb-1 block">BRUTO €</label>
                <input type="number" step="0.001" value={aqBruto} onChange={(e) => setAqBruto(e.target.value)}
                       className="w-full border-2 border-stone-900 p-2 text-xs font-mono focus:bg-white focus:outline-none" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-stone-700 mb-1 block">DTO %</label>
                <input type="number" step="0.01" value={aqDto} onChange={(e) => setAqDto(e.target.value)}
                       className="w-full border-2 border-stone-900 p-2 text-xs font-mono focus:bg-white focus:outline-none" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-stone-700 mb-1 block">MARCA</label>
                <input type="text" value={aqMarca} onChange={(e) => setAqMarca(e.target.value)}
                       className="w-full border-2 border-stone-900 p-2 text-xs font-mono focus:bg-white focus:outline-none" />
              </div>
            </div>
            {aqNeto !== null && (
              <div className="mt-2 text-xs font-bold text-emerald-900">
                Precio neto = €{aqNeto}/{unidad}
              </div>
            )}
          </div>

          {/* Aramburu */}
          <div className="border-2 border-amber-700 bg-amber-50 p-3">
            <div className="font-black text-sm text-amber-900 mb-2" style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>
              🟡 ARAMBURU {!arRef && <span className="text-[10px] font-normal opacity-60">(opcional)</span>}
            </div>
            <div className="grid grid-cols-4 gap-2">
              <div>
                <label className="text-[10px] font-bold text-stone-700 mb-1 block">REF</label>
                <input type="text" value={arRef} onChange={(e) => setArRef(e.target.value)}
                       className="w-full border-2 border-stone-900 p-2 text-xs font-mono focus:bg-white focus:outline-none" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-stone-700 mb-1 block">BRUTO €</label>
                <input type="number" step="0.001" value={arBruto} onChange={(e) => setArBruto(e.target.value)}
                       className="w-full border-2 border-stone-900 p-2 text-xs font-mono focus:bg-white focus:outline-none" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-stone-700 mb-1 block">DTO %</label>
                <input type="number" step="0.01" value={arDto} onChange={(e) => setArDto(e.target.value)}
                       className="w-full border-2 border-stone-900 p-2 text-xs font-mono focus:bg-white focus:outline-none" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-stone-700 mb-1 block">MARCA</label>
                <input type="text" value={arMarca} onChange={(e) => setArMarca(e.target.value)}
                       className="w-full border-2 border-stone-900 p-2 text-xs font-mono focus:bg-white focus:outline-none" />
              </div>
            </div>
            {arNeto !== null && (
              <div className="mt-2 text-xs font-bold text-amber-900">
                Precio neto = €{arNeto}/{unidad}
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-2 border-t-2 border-stone-200">
            <button onClick={onCerrar}
                    className="flex-1 text-xs font-bold tracking-widest p-3 border-2 border-stone-900 bg-white hover:bg-stone-100">
              CANCELAR
            </button>
            <button onClick={handleGuardar} disabled={guardando}
                    className={`flex-[2] text-xs font-black tracking-widest p-3 border-2 border-stone-900 transition-all ${
                      guardando ? "bg-stone-300 text-stone-600 cursor-wait" : "bg-stone-900 text-amber-400 hover:bg-amber-400 hover:text-stone-900"
                    }`}
                    style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>
              {guardando ? "GUARDANDO…" : esValidacion ? "✓ VALIDAR Y AÑADIR" : "💾 GUARDAR"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// =========================================================
//  PESTAÑA OBRAS
// =========================================================
function PestañaObras({ data, api, reload }) {
  const [añadiendo, setAñadiendo] = useState(false);
  const [editando, setEditando] = useState(null);

  const obras = data.obras || [];

  const handleValidar = async (o) => {
    await api.put("/admin/obra/" + o.id, { pendienteValidar: false });
    reload();
  };
  const handleBorrar = async (o) => {
    if (!confirm(`¿Borrar la obra "${o.nombre}"? Los pedidos hechos a esta obra no se borran.`)) return;
    await api.del("/admin/obra/" + o.id);
    reload();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="text-xs tracking-widest text-stone-700">{obras.length} OBRAS</div>
        <button onClick={() => setAñadiendo(true)}
                className="bg-stone-900 text-amber-400 px-4 py-2 text-xs font-black tracking-widest border-2 border-stone-900 hover:bg-amber-400 hover:text-stone-900"
                style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>
          + NUEVA OBRA
        </button>
      </div>

      <div className="bg-white border-2 border-stone-900 divide-y divide-stone-200">
        {obras.map(o => (
          <div key={o.id} className="p-3 flex items-start justify-between gap-3 hover:bg-amber-50">
            <div className="flex-1 min-w-0">
              <div className="font-bold text-sm flex items-center gap-2">
                {o.nombre}
                {o.pendienteValidar && (
                  <span className="text-[9px] bg-amber-500 text-stone-900 px-1.5 py-0.5 font-bold border border-stone-900">PENDIENTE VALIDAR</span>
                )}
                {o.activa === false && (
                  <span className="text-[9px] bg-red-600 text-white px-1.5 py-0.5 font-bold">INACTIVA</span>
                )}
              </div>
              <div className="text-[10px] text-stone-500 mt-0.5">
                {o.dir || "Sin dirección"}
                {o.creadaPor && <> · creada por <strong>{o.creadaPor}</strong></>}
                {o.creadaEn && <> · {new Date(o.creadaEn).toLocaleDateString("es-ES")}</>}
              </div>
            </div>
            <div className="flex gap-1">
              {o.pendienteValidar && (
                <button onClick={() => handleValidar(o)}
                        className="text-[10px] font-bold bg-emerald-700 text-white px-2 py-1 border border-stone-900 hover:bg-emerald-800">
                  ✓ VALIDAR
                </button>
              )}
              <button onClick={() => setEditando(o)}
                      className="text-[10px] font-bold bg-amber-500 text-stone-900 px-2 py-1 border border-stone-900 hover:bg-amber-400">
                ✏
              </button>
              <button onClick={() => handleBorrar(o)}
                      className="text-[10px] font-bold bg-red-600 text-white px-2 py-1 border border-stone-900 hover:bg-red-700">
                🗑
              </button>
            </div>
          </div>
        ))}
      </div>

      {añadiendo && <ModalEditarObra obra={null} api={api} reload={reload} onCerrar={() => setAñadiendo(false)} />}
      {editando && <ModalEditarObra obra={editando} api={api} reload={reload} onCerrar={() => setEditando(null)} />}
    </div>
  );
}

function ModalEditarObra({ obra, api, reload, onCerrar }) {
  const [nombre, setNombre] = useState(obra?.nombre || "");
  const [dir, setDir] = useState(obra?.dir || "");
  const [activa, setActiva] = useState(obra?.activa !== false);
  const [guardando, setGuardando] = useState(false);

  const handleGuardar = async () => {
    if (!nombre.trim()) return alert("El nombre es obligatorio");
    setGuardando(true);
    try {
      if (obra) {
        await api.put("/admin/obra/" + obra.id, { nombre, dir, activa, pendienteValidar: false });
      } else {
        await api.post("/admin/obra", { nombre, dir });
      }
      reload();
      onCerrar();
    } catch (e) {
      alert("Error: " + e.message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-stone-900/50" onClick={onCerrar} />
      <div className="relative bg-white border-4 border-stone-900 w-full max-w-md shadow-[8px_8px_0_0_rgba(0,0,0,1)]">
        <div className="bg-amber-500 border-b-4 border-stone-900 p-3 flex items-center justify-between">
          <h3 className="font-black text-base" style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>
            {obra ? "✏ EDITAR OBRA" : "+ NUEVA OBRA"}
          </h3>
          <button onClick={onCerrar} className="bg-stone-900 text-amber-400 p-1.5 border-2 border-stone-900">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <label className="text-[10px] tracking-widest font-bold text-stone-700 mb-1 block">NOMBRE</label>
            <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)}
                   className="w-full border-2 border-stone-900 p-2 text-sm focus:bg-amber-50 focus:outline-none font-mono" />
          </div>
          <div>
            <label className="text-[10px] tracking-widest font-bold text-stone-700 mb-1 block">DIRECCIÓN</label>
            <input type="text" value={dir} onChange={(e) => setDir(e.target.value)}
                   className="w-full border-2 border-stone-900 p-2 text-sm focus:bg-amber-50 focus:outline-none font-mono" />
          </div>
          {obra && (
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={activa} onChange={(e) => setActiva(e.target.checked)} />
              <span>Obra activa (visible para operarios)</span>
            </label>
          )}
          <div className="flex gap-2 pt-2 border-t-2 border-stone-200">
            <button onClick={onCerrar}
                    className="flex-1 text-xs font-bold tracking-widest p-3 border-2 border-stone-900 bg-white hover:bg-stone-100">
              CANCELAR
            </button>
            <button onClick={handleGuardar} disabled={guardando}
                    className={`flex-[2] text-xs font-black tracking-widest p-3 border-2 border-stone-900 transition-all ${
                      guardando ? "bg-stone-300 cursor-wait" : "bg-stone-900 text-amber-400 hover:bg-amber-400 hover:text-stone-900"
                    }`}
                    style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>
              {guardando ? "..." : "💾 GUARDAR"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// =========================================================
//  PESTAÑA OPERARIOS
// =========================================================
function PestañaOperarios({ data, api, reload }) {
  const [nombre, setNombre] = useState("");
  const [añadiendo, setAñadiendo] = useState(false);

  const operarios = data.operarios || [];

  const handleAdd = async () => {
    if (!nombre.trim() || nombre === "Otro (escribir nombre)") return;
    setAñadiendo(true);
    try {
      await api.post("/admin/operario", { nombre: nombre.trim(), activo: true });
      setNombre("");
      reload();
    } finally {
      setAñadiendo(false);
    }
  };
  const handleToggle = async (op) => {
    await api.put("/admin/operario/" + op.id, { activo: !op.activo });
    reload();
  };
  const handleDelete = async (op) => {
    if (!confirm(`¿Borrar a "${op.nombre}"?`)) return;
    await api.del("/admin/operario/" + op.id);
    reload();
  };

  return (
    <div className="space-y-4">
      <div className="bg-white border-2 border-stone-900 p-3">
        <div className="text-[10px] tracking-widest font-bold text-stone-700 mb-2">AÑADIR OPERARIO</div>
        <div className="flex gap-2">
          <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)}
                 placeholder="Nombre completo del operario"
                 onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                 className="flex-1 border-2 border-stone-900 p-2 text-sm focus:bg-amber-50 focus:outline-none font-mono" />
          <button onClick={handleAdd} disabled={añadiendo || nombre.trim().length < 2}
                  className={`px-4 py-2 text-xs font-black tracking-widest border-2 border-stone-900 ${
                    añadiendo || nombre.trim().length < 2
                      ? "bg-stone-200 text-stone-400 cursor-not-allowed"
                      : "bg-stone-900 text-amber-400 hover:bg-amber-400 hover:text-stone-900"
                  }`}
                  style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>
            + AÑADIR
          </button>
        </div>
      </div>

      <div className="bg-white border-2 border-stone-900 divide-y divide-stone-200">
        {operarios.map(op => (
          <div key={op.id} className="p-3 flex items-center justify-between gap-3 hover:bg-amber-50">
            <div className="flex-1">
              <div className="font-bold text-sm">{op.nombre}</div>
              <div className="text-[10px] text-stone-500">
                {op.activo === false ? <span className="text-red-700">INACTIVO</span> : "Activo"}
              </div>
            </div>
            <button onClick={() => handleToggle(op)}
                    className="text-[10px] font-bold bg-amber-500 text-stone-900 px-2 py-1 border border-stone-900 hover:bg-amber-400">
              {op.activo === false ? "✓ ACTIVAR" : "⏸ DESACTIVAR"}
            </button>
            <button onClick={() => handleDelete(op)}
                    className="text-[10px] font-bold bg-red-600 text-white px-2 py-1 border border-stone-900 hover:bg-red-700">
              🗑
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// =========================================================
//  PESTAÑA PEDIDOS
// =========================================================
function PestañaPedidos({ data }) {
  const [filtroObra, setFiltroObra] = useState("");
  const [filtroOp, setFiltroOp] = useState("");
  const [pedidoSel, setPedidoSel] = useState(null);

  const pedidos = (data.pedidos || []).slice().reverse(); // más reciente primero

  const filtrados = pedidos.filter(p => {
    if (filtroObra && p.obra?.id !== filtroObra) return false;
    if (filtroOp && p.operario !== filtroOp) return false;
    return true;
  });

  const totalFiltrados = filtrados.reduce((s, p) =>
    s + (p.lineasAqua || []).reduce((a, l) => a + (l.importe || 0), 0)
      + (p.lineasAram || []).reduce((a, l) => a + (l.importe || 0), 0), 0);

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="bg-white border-2 border-stone-900 p-3 grid grid-cols-1 md:grid-cols-2 gap-2">
        <select value={filtroObra} onChange={(e) => setFiltroObra(e.target.value)}
                className="border-2 border-stone-900 p-2 text-xs focus:bg-amber-50 focus:outline-none font-mono">
          <option value="">— Todas las obras —</option>
          {(data.obras || []).map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
        </select>
        <select value={filtroOp} onChange={(e) => setFiltroOp(e.target.value)}
                className="border-2 border-stone-900 p-2 text-xs focus:bg-amber-50 focus:outline-none font-mono">
          <option value="">— Todos los operarios —</option>
          {(data.operarios || []).map(op => <option key={op.id} value={op.nombre}>{op.nombre}</option>)}
        </select>
      </div>

      {/* Stats */}
      <div className="bg-stone-900 text-amber-400 p-3 border-2 border-stone-900 flex items-center justify-between">
        <div>
          <div className="text-[10px] tracking-widest opacity-70">PEDIDOS MOSTRADOS</div>
          <div className="font-black text-xl" style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>{filtrados.length}</div>
        </div>
        <div className="text-right">
          <div className="text-[10px] tracking-widest opacity-70">TOTAL BASE</div>
          <div className="font-black text-xl" style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>€{totalFiltrados.toFixed(2)}</div>
        </div>
      </div>

      {/* Lista */}
      <div className="bg-white border-2 border-stone-900 divide-y divide-stone-200">
        {filtrados.length === 0 ? (
          <div className="p-8 text-center text-stone-500 text-sm">No hay pedidos que mostrar</div>
        ) : filtrados.slice(0, 200).map(p => {
          const totA = (p.lineasAqua || []).reduce((s, l) => s + (l.importe || 0), 0);
          const totR = (p.lineasAram || []).reduce((s, l) => s + (l.importe || 0), 0);
          return (
            <button key={p.id} onClick={() => setPedidoSel(p)}
                    className="w-full text-left p-3 hover:bg-amber-50 transition-all">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm">{p.obra?.nombre || "—"}</div>
                  <div className="text-[10px] text-stone-500 mt-0.5">
                    {new Date(p.fecha).toLocaleDateString("es-ES", { dateStyle: "long" })} · {p.operario}
                  </div>
                  <div className="text-[10px] mt-1 flex gap-2 flex-wrap">
                    {totA > 0 && <span className="bg-emerald-100 text-emerald-900 px-1.5 py-0.5 font-bold">Aqua €{totA.toFixed(2)}</span>}
                    {totR > 0 && <span className="bg-amber-100 text-amber-900 px-1.5 py-0.5 font-bold">Aram €{totR.toFixed(2)}</span>}
                    {(p.lineasNoListado || []).length > 0 && <span className="bg-stone-200 text-stone-700 px-1.5 py-0.5 font-bold">+{p.lineasNoListado.length} no list.</span>}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-black text-base" style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>€{((totA + totR) * 1.21).toFixed(2)}</div>
                  <div className="text-[9px] text-stone-500">IVA inc.</div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {pedidoSel && <ModalDetallePedido pedido={pedidoSel} onCerrar={() => setPedidoSel(null)} />}
    </div>
  );
}

function ModalDetallePedido({ pedido, onCerrar }) {
  const totA = (pedido.lineasAqua || []).reduce((s, l) => s + (l.importe || 0), 0);
  const totR = (pedido.lineasAram || []).reduce((s, l) => s + (l.importe || 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-stone-900/50" onClick={onCerrar} />
      <div className="relative bg-white border-4 border-stone-900 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-[8px_8px_0_0_rgba(0,0,0,1)]">
        <div className="bg-amber-500 border-b-4 border-stone-900 p-3 flex items-center justify-between sticky top-0 z-10">
          <div>
            <h3 className="font-black text-base" style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>
              PEDIDO {pedido.id}
            </h3>
            <div className="text-[10px]">{new Date(pedido.fecha).toLocaleString("es-ES")}</div>
          </div>
          <button onClick={onCerrar} className="bg-stone-900 text-amber-400 p-1.5 border-2 border-stone-900">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div><strong>Obra:</strong> {pedido.obra?.nombre}</div>
            <div><strong>Solicita:</strong> {pedido.operario}</div>
            <div className="col-span-2 text-[10px] text-stone-500">{pedido.obra?.dir}</div>
          </div>

          {pedido.lineasAqua?.length > 0 && (
            <div className="border-2 border-emerald-700">
              <div className="bg-emerald-700 text-white p-2 text-xs font-bold tracking-widest">AQUATUBO · €{totA.toFixed(2)}</div>
              <div className="divide-y">
                {pedido.lineasAqua.map((l, i) => (
                  <div key={i} className="p-2 text-xs flex justify-between gap-2">
                    <div className="flex-1">
                      <div className="font-mono text-[10px] text-stone-500">{l.ref}</div>
                      <div>{l.desc}</div>
                    </div>
                    <div className="text-right shrink-0 font-mono">
                      <div>{l.cantidad} × €{l.precioUnit?.toFixed(2)}</div>
                      <div className="font-bold">€{l.importe?.toFixed(2)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {pedido.lineasAram?.length > 0 && (
            <div className="border-2 border-amber-700">
              <div className="bg-amber-700 text-white p-2 text-xs font-bold tracking-widest">ARAMBURU · €{totR.toFixed(2)}</div>
              <div className="divide-y">
                {pedido.lineasAram.map((l, i) => (
                  <div key={i} className="p-2 text-xs flex justify-between gap-2">
                    <div className="flex-1">
                      <div className="font-mono text-[10px] text-stone-500">{l.ref}</div>
                      <div>{l.desc}</div>
                    </div>
                    <div className="text-right shrink-0 font-mono">
                      <div>{l.cantidad} × €{l.precioUnit?.toFixed(2)}</div>
                      <div className="font-bold">€{l.importe?.toFixed(2)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {pedido.lineasNoListado?.length > 0 && (
            <div className="border-2 border-stone-700 bg-stone-50">
              <div className="bg-stone-700 text-white p-2 text-xs font-bold tracking-widest">PRODUCTOS NO LISTADOS</div>
              <div className="divide-y">
                {pedido.lineasNoListado.map((l, i) => (
                  <div key={i} className="p-2 text-xs">
                    <div>{l.cantidad} {l.unidad} · {l.desc}</div>
                    {l.proveedor !== "indistinto" && <div className="text-[10px] text-stone-500">prov: {l.proveedor === "aqua" ? "Aquatubo" : "Aramburu"}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {pedido.notas && (
            <div className="border-2 border-stone-300 bg-amber-50 p-2 text-xs">
              <div className="font-bold mb-1">📝 Notas:</div>
              <div className="whitespace-pre-wrap">{pedido.notas}</div>
            </div>
          )}

          <div className="bg-stone-900 text-amber-400 p-3 flex justify-between items-baseline">
            <div className="text-xs tracking-widest">TOTAL c/IVA</div>
            <div className="font-black text-2xl" style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>
              €{((totA + totR) * 1.21).toFixed(2)}
            </div>
          </div>

          {pedido.proveedoresEnviados?.length > 0 && (
            <div className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-700 p-2">
              📧 Email enviado a: {pedido.proveedoresEnviados.join(", ")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// =========================================================
//  PESTAÑA CONFIG
// =========================================================
function PestañaConfig({ data, api, reload, pin, onSalir }) {
  const dc = data.datosCliente || {};
  const ce = data.configEmail || {};
  const [razon, setRazon] = useState(dc.razonSocial || "");
  const [cif, setCif] = useState(dc.cif || "");
  const [direccion, setDireccion] = useState(dc.direccion || "");
  const [tel, setTel] = useState(dc.telefono || "");
  const [emailC, setEmailC] = useState(dc.email || "");
  const [pago, setPago] = useState(dc.formaPago || "");

  const [emailAqua, setEmailAqua] = useState(ce.emailAquatubo || "");
  const [emailAram, setEmailAram] = useState(ce.emailAramburu || "");
  const [emailCC, setEmailCC] = useState(ce.emailCC || "");
  const [firmaNombre, setFirmaNombre] = useState(ce.nombreFirma || "");
  const [firmaTel, setFirmaTel] = useState(ce.telefonoFirma || "");
  const [emailActivo, setEmailActivo] = useState(ce.activo || false);

  const [pinViejo, setPinViejo] = useState("");
  const [pinNuevo, setPinNuevo] = useState("");

  const [guardando, setGuardando] = useState("");

  const guardarDatos = async () => {
    setGuardando("datos");
    try {
      await api.put("/admin/datos-cliente", {
        razonSocial: razon, cif, direccion, telefono: tel, email: emailC, formaPago: pago
      });
      reload();
      alert("✓ Datos del cliente guardados");
    } catch (e) { alert("Error: " + e.message); }
    finally { setGuardando(""); }
  };
  const guardarEmail = async () => {
    setGuardando("email");
    try {
      await api.put("/admin/config-email", {
        emailAquatubo: emailAqua, emailAramburu: emailAram, emailCC, nombreFirma: firmaNombre, telefonoFirma: firmaTel, activo: emailActivo
      });
      reload();
      alert("✓ Configuración de email guardada");
    } catch (e) { alert("Error: " + e.message); }
    finally { setGuardando(""); }
  };
  const cambiarPin = async () => {
    if (!/^\d{4,8}$/.test(pinNuevo)) return alert("El nuevo PIN debe ser de 4 a 8 dígitos");
    if (!confirm("¿Cambiar el PIN? Tendrás que volver a entrar con el nuevo.")) return;
    try {
      await api.post("/admin/cambiar-pin", { nuevoPin: pinNuevo });
      alert("✓ PIN cambiado. Volviendo al login.");
      onSalir();
    } catch (e) { alert("Error: " + e.message); }
  };

  return (
    <div className="space-y-4">
      {/* Datos cliente */}
      <div className="bg-white border-2 border-stone-900">
        <div className="bg-stone-900 text-amber-400 p-2 text-xs font-bold tracking-widest" style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>
          🏢 DATOS DE ARA CORPORATE (aparecen en cabecera de pedidos)
        </div>
        <div className="p-3 space-y-2 text-xs">
          {[
            ["Razón social", razon, setRazon],
            ["CIF", cif, setCif],
            ["Dirección", direccion, setDireccion],
            ["Teléfono", tel, setTel],
            ["Email", emailC, setEmailC],
            ["Forma de pago", pago, setPago],
          ].map(([lbl, v, setV]) => (
            <div key={lbl}>
              <label className="text-[10px] tracking-widest font-bold text-stone-700 mb-0.5 block">{lbl.toUpperCase()}</label>
              <input type="text" value={v} onChange={(e) => setV(e.target.value)}
                     className="w-full border-2 border-stone-900 p-2 focus:bg-amber-50 focus:outline-none font-mono" />
            </div>
          ))}
          <button onClick={guardarDatos} disabled={guardando === "datos"}
                  className="bg-stone-900 text-amber-400 px-4 py-2 text-xs font-black tracking-widest border-2 border-stone-900 hover:bg-amber-400 hover:text-stone-900"
                  style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>
            {guardando === "datos" ? "..." : "💾 GUARDAR DATOS"}
          </button>
        </div>
      </div>

      {/* Email */}
      <div className="bg-white border-2 border-stone-900">
        <div className="bg-stone-900 text-amber-400 p-2 text-xs font-bold tracking-widest" style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>
          📧 ENVÍO DE PEDIDOS POR EMAIL
        </div>
        <div className="p-3 space-y-2 text-xs">
          <div className="text-[10px] text-stone-500 leading-relaxed bg-stone-50 p-2 border border-stone-300">
            Para activar el envío automático por email necesitas:
            <br />1) Crear cuenta en <strong>resend.com</strong> (gratis hasta 3.000 emails/mes)
            <br />2) Añadir su API key en Render → araujo-bot → Environment como <code className="bg-stone-200 px-1">ARA_RESEND_API_KEY</code>
            <br />3) Activar el switch de abajo
          </div>
          {[
            ["Email pedidos AQUATUBO", emailAqua, setEmailAqua],
            ["Email pedidos ARAMBURU", emailAram, setEmailAram],
            ["Email CC (copia)", emailCC, setEmailCC],
            ["Nombre firma", firmaNombre, setFirmaNombre],
            ["Teléfono firma", firmaTel, setFirmaTel],
          ].map(([lbl, v, setV]) => (
            <div key={lbl}>
              <label className="text-[10px] tracking-widest font-bold text-stone-700 mb-0.5 block">{lbl.toUpperCase()}</label>
              <input type="text" value={v} onChange={(e) => setV(e.target.value)}
                     className="w-full border-2 border-stone-900 p-2 focus:bg-amber-50 focus:outline-none font-mono" />
            </div>
          ))}
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={emailActivo} onChange={(e) => setEmailActivo(e.target.checked)} />
            <span className="font-bold">Envío de email activado</span>
          </label>
          <button onClick={guardarEmail} disabled={guardando === "email"}
                  className="bg-stone-900 text-amber-400 px-4 py-2 text-xs font-black tracking-widest border-2 border-stone-900 hover:bg-amber-400 hover:text-stone-900"
                  style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>
            {guardando === "email" ? "..." : "💾 GUARDAR EMAIL"}
          </button>
        </div>
      </div>

      {/* Cambiar PIN */}
      <div className="bg-white border-2 border-stone-900">
        <div className="bg-red-600 text-white p-2 text-xs font-bold tracking-widest" style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>
          🔐 CAMBIAR PIN ADMIN
        </div>
        <div className="p-3 space-y-2 text-xs">
          <div>
            <label className="text-[10px] tracking-widest font-bold text-stone-700 mb-0.5 block">NUEVO PIN (4-8 dígitos)</label>
            <input type="password" value={pinNuevo} onChange={(e) => setPinNuevo(e.target.value)}
                   maxLength={8}
                   className="w-full border-2 border-stone-900 p-2 focus:bg-amber-50 focus:outline-none font-mono" />
          </div>
          <button onClick={cambiarPin} disabled={pinNuevo.length < 4}
                  className={`px-4 py-2 text-xs font-black tracking-widest border-2 border-stone-900 ${
                    pinNuevo.length >= 4 ? "bg-red-600 text-white hover:bg-red-700" : "bg-stone-200 text-stone-400 cursor-not-allowed"
                  }`}
                  style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>
            🔐 CAMBIAR PIN
          </button>
        </div>
      </div>
    </div>
  );
}

// =========================================================
//  ROOT
// =========================================================
export default function App() {
  const [usuario, setUsuario] = useState(null);
  const [, forceUpdate] = useState(0);
  const [cargando, setCargando] = useState(!datosCargados);
  const [adminPin, setAdminPin] = useState(null);
  const [vistaAdmin, setVistaAdmin] = useState(
    typeof window !== "undefined" && (
      window.location.search.includes("admin") ||
      window.location.hash.includes("admin")
    )
  );

  useEffect(() => {
    if (datosCargados) return;
    cargarDatosBackend().then(() => {
      setCargando(false);
      forceUpdate(n => n + 1);
    });
  }, []);

  if (cargando) {
    return (
      <div className="min-h-screen bg-stone-100 flex items-center justify-center font-mono p-6"
           style={{ backgroundImage: "repeating-linear-gradient(45deg, transparent, transparent 30px, rgba(0,0,0,0.02) 30px, rgba(0,0,0,0.02) 31px)" }}>
        <div className="bg-amber-500 border-4 border-stone-900 p-6 shadow-[8px_8px_0_0_rgba(0,0,0,1)] max-w-md w-full text-center">
          <div className="text-[10px] tracking-[0.3em] mb-2">ARA CORPORATE</div>
          <h1 className="font-black text-3xl leading-none mb-3" style={{ fontFamily: "Archivo Black, Impact, sans-serif" }}>
            CARGANDO CATÁLOGO…
          </h1>
          <div className="flex items-center justify-center gap-1 my-4">
            <span className="w-2 h-2 bg-stone-900 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
            <span className="w-2 h-2 bg-stone-900 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
            <span className="w-2 h-2 bg-stone-900 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
          </div>
          <div className="text-xs">Conectando con el sistema…</div>
        </div>
      </div>
    );
  }

  // Vista admin (con PIN o pidiendo PIN)
  if (vistaAdmin) {
    if (!adminPin) {
      return <PantallaLoginAdmin
        onLogin={(pin) => setAdminPin(pin)}
        onSalir={() => {
          setVistaAdmin(false);
          if (window.history && window.location.search.includes("admin")) {
            window.history.replaceState({}, "", window.location.pathname);
          }
        }}
      />;
    }
    return <PanelAdmin pin={adminPin} onSalir={() => {
      setAdminPin(null);
      setVistaAdmin(false);
      if (window.history && window.location.search.includes("admin")) {
        window.history.replaceState({}, "", window.location.pathname);
      }
    }} />;
  }

  // Vista operario normal
  if (!usuario) return <PantallaLogin onLogin={setUsuario} onAdminClick={() => setVistaAdmin(true)} />;
  return <CatalogoApp usuario={usuario} onLogout={() => setUsuario(null)} />;
}
