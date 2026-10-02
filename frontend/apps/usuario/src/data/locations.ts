/** Un municipio o distrito de Colombia identificado con su código DIVIPOLA. */
export type Locality = {
  id: string;
  name: string;
  context: string;
  departmentCode: string;
  kind: string;
};

export type Department = { code: string; name: string };

export type AdministrativeDivision = {
  departments: Department[];
  municipalities: Locality[];
};
