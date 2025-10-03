import { SVGProps } from "react";

export type IconSvgProps = SVGProps<SVGSVGElement> & {
  size?: number;
};

export type PolicyType = {
  id: number;
  name: string;
  description: string;
  parameters: Record<string, any>; 
  created_at: string;
  is_cis: boolean; 
};

export type Policy = {
  id: number;
  name: string;
  parameters: Record<string, any>;
  description: string;
  created_at: string;
  policy_type: string; 
  policy_type_name: string; 
  policy_type_parameters: Record<string, any>;
  is_cis: boolean; 
};
