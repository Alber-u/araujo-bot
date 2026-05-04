// Extraído del frontend actual
const CATALOGO = [
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
module.exports = { CATALOGO };
