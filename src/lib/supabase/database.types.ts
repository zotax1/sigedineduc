
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "app_settings": {
                  Row: {
                    "allowed_extensions": (string)[],"deadline_warning_days": number,"id": boolean,"max_attachment_mb": number,"stale_stage_days": number,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "allowed_extensions"?: (string)[],"deadline_warning_days"?: number,"id"?: boolean,"max_attachment_mb"?: number,"stale_stage_days"?: number,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "allowed_extensions"?: (string)[],"deadline_warning_days"?: number,"id"?: boolean,"max_attachment_mb"?: number,"stale_stage_days"?: number,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "app_settings_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"audit_logs": {
                  Row: {
                    "action": string,"actor_email": string | null,"actor_id": string | null,"changes": Json | null,"id": number,"occurred_at": string,"record_id": string | null,"summary": string | null,"table_name": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_email"?: string | null,"actor_id"?: string | null,"changes"?: Json | null,"id"?: never,"occurred_at"?: string,"record_id"?: string | null,"summary"?: string | null,"table_name"?: string | null
                  }
                  Update: {
                    "action"?: string,"actor_email"?: string | null,"actor_id"?: string | null,"changes"?: Json | null,"id"?: never,"occurred_at"?: string,"record_id"?: string | null,"summary"?: string | null,"table_name"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"departments": {
                  Row: {
                    "active": boolean,"code": string,"contact_name": string | null,"contact_title": string | null,"created_at": string,"created_by": string | null,"description": string | null,"email": string | null,"id": string,"is_external": boolean,"is_system": boolean,"name": string,"phone": string | null,"short_name": string | null,"sort_order": number,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"code": string,"contact_name"?: string | null,"contact_title"?: string | null,"created_at"?: string,"created_by"?: string | null,"description"?: string | null,"email"?: string | null,"id"?: string,"is_external"?: boolean,"is_system"?: boolean,"name": string,"phone"?: string | null,"short_name"?: string | null,"sort_order"?: number,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "active"?: boolean,"code"?: string,"contact_name"?: string | null,"contact_title"?: string | null,"created_at"?: string,"created_by"?: string | null,"description"?: string | null,"email"?: string | null,"id"?: string,"is_external"?: boolean,"is_system"?: boolean,"name"?: string,"phone"?: string | null,"short_name"?: string | null,"sort_order"?: number,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "departments_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "departments_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"document_access": {
                  Row: {
                    "document_id": string,"granted_at": string,"granted_by": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "document_id": string,"granted_at"?: string,"granted_by"?: string | null,"user_id": string
                  }
                  Update: {
                    "document_id"?: string,"granted_at"?: string,"granted_by"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "document_access_document_id_fkey"
      columns: ["document_id"]
isOneToOne: false
      referencedRelation: "document_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "document_access_document_id_fkey"
      columns: ["document_id"]
isOneToOne: false
      referencedRelation: "documents"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "document_access_granted_by_fkey"
      columns: ["granted_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "document_access_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"document_attachments": {
                  Row: {
                    "description": string | null,"document_id": string,"extension": string,"id": string,"mime_type": string,"original_filename": string,"removal_reason": string | null,"removed_at": string | null,"removed_by": string | null,"replaces_attachment_id": string | null,"size_bytes": number,"storage_path": string,"uploaded_at": string,"uploaded_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "description"?: string | null,"document_id": string,"extension": string,"id"?: string,"mime_type": string,"original_filename": string,"removal_reason"?: string | null,"removed_at"?: string | null,"removed_by"?: string | null,"replaces_attachment_id"?: string | null,"size_bytes": number,"storage_path": string,"uploaded_at"?: string,"uploaded_by"?: string | null
                  }
                  Update: {
                    "description"?: string | null,"document_id"?: string,"extension"?: string,"id"?: string,"mime_type"?: string,"original_filename"?: string,"removal_reason"?: string | null,"removed_at"?: string | null,"removed_by"?: string | null,"replaces_attachment_id"?: string | null,"size_bytes"?: number,"storage_path"?: string,"uploaded_at"?: string,"uploaded_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "document_attachments_document_id_fkey"
      columns: ["document_id"]
isOneToOne: false
      referencedRelation: "document_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "document_attachments_document_id_fkey"
      columns: ["document_id"]
isOneToOne: false
      referencedRelation: "documents"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "document_attachments_removed_by_fkey"
      columns: ["removed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "document_attachments_replaces_attachment_id_fkey"
      columns: ["replaces_attachment_id"]
isOneToOne: false
      referencedRelation: "document_attachments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "document_attachments_uploaded_by_fkey"
      columns: ["uploaded_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"document_counters": {
                  Row: {
                    "direction": Database["public"]['Enums']["document_direction"],"last_value": number,"year": number
                  }
                  ComputedFields: never
                  Insert: {
                    "direction": Database["public"]['Enums']["document_direction"],"last_value"?: number,"year": number
                  }
                  Update: {
                    "direction"?: Database["public"]['Enums']["document_direction"],"last_value"?: number,"year"?: number
                  }
                  Relationships: [
                    
                  ]
                },"document_route_events": {
                  Row: {
                    "action": string,"attachment_id": string | null,"created_at": string,"document_id": string,"event_type": Database["public"]['Enums']["route_event_type"],"from_department_id": string | null,"from_responsible_id": string | null,"from_status": Database["public"]['Enums']["document_status"] | null,"id": string,"notes": string | null,"occurred_at": string,"recorded_by": string | null,"reverses_event_id": string | null,"seq": number,"to_department_id": string | null,"to_responsible_id": string | null,"to_status": Database["public"]['Enums']["document_status"] | null
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"attachment_id"?: string | null,"created_at"?: string,"document_id": string,"event_type": Database["public"]['Enums']["route_event_type"],"from_department_id"?: string | null,"from_responsible_id"?: string | null,"from_status"?: Database["public"]['Enums']["document_status"] | null,"id"?: string,"notes"?: string | null,"occurred_at"?: string,"recorded_by"?: string | null,"reverses_event_id"?: string | null,"seq"?: never,"to_department_id"?: string | null,"to_responsible_id"?: string | null,"to_status"?: Database["public"]['Enums']["document_status"] | null
                  }
                  Update: {
                    "action"?: string,"attachment_id"?: string | null,"created_at"?: string,"document_id"?: string,"event_type"?: Database["public"]['Enums']["route_event_type"],"from_department_id"?: string | null,"from_responsible_id"?: string | null,"from_status"?: Database["public"]['Enums']["document_status"] | null,"id"?: string,"notes"?: string | null,"occurred_at"?: string,"recorded_by"?: string | null,"reverses_event_id"?: string | null,"seq"?: never,"to_department_id"?: string | null,"to_responsible_id"?: string | null,"to_status"?: Database["public"]['Enums']["document_status"] | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "document_route_events_attachment_id_fkey"
      columns: ["attachment_id"]
isOneToOne: false
      referencedRelation: "document_attachments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "document_route_events_document_id_fkey"
      columns: ["document_id"]
isOneToOne: false
      referencedRelation: "document_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "document_route_events_document_id_fkey"
      columns: ["document_id"]
isOneToOne: false
      referencedRelation: "documents"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "document_route_events_from_department_id_fkey"
      columns: ["from_department_id"]
isOneToOne: false
      referencedRelation: "departments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "document_route_events_from_responsible_id_fkey"
      columns: ["from_responsible_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "document_route_events_recorded_by_fkey"
      columns: ["recorded_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "document_route_events_reverses_event_id_fkey"
      columns: ["reverses_event_id"]
isOneToOne: true
      referencedRelation: "document_route_events"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "document_route_events_reverses_event_id_fkey"
      columns: ["reverses_event_id"]
isOneToOne: true
      referencedRelation: "route_event_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "document_route_events_to_department_id_fkey"
      columns: ["to_department_id"]
isOneToOne: false
      referencedRelation: "departments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "document_route_events_to_responsible_id_fkey"
      columns: ["to_responsible_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"document_types": {
                  Row: {
                    "active": boolean,"created_at": string,"description": string | null,"id": string,"name": string,"sort_order": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"created_at"?: string,"description"?: string | null,"id"?: string,"name": string,"sort_order"?: number,"updated_at"?: string
                  }
                  Update: {
                    "active"?: boolean,"created_at"?: string,"description"?: string | null,"id"?: string,"name"?: string,"sort_order"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"documents": {
                  Row: {
                    "archived_at": string | null,"completed_at": string | null,"created_at": string,"created_by": string | null,"current_department_id": string,"description": string | null,"destination_institution": string | null,"direction": Database["public"]['Enums']["document_direction"],"document_type_id": string | null,"due_date": string | null,"id": string,"internal_reference": string,"is_demo": boolean,"issued_on": string | null,"next_action": string | null,"observations": string | null,"official_number": string | null,"origin_department_id": string | null,"priority_code": string,"received_at_decanato_at": string | null,"received_at_di_at": string | null,"received_by_name": string | null,"received_on": string | null,"recipient_department_id": string | null,"recipient_name": string | null,"registered_at": string,"remitted_to_decanato_at": string | null,"remitted_to_di_at": string | null,"responsible_id": string | null,"search_text": string | null,"sender_institution": string | null,"sender_name": string | null,"stage_changed_at": string,"status": Database["public"]['Enums']["document_status"],"subject": string,"updated_at": string,"updated_by": string | null,"visibility": Database["public"]['Enums']["document_visibility"]
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"completed_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"current_department_id"?: string,"description"?: string | null,"destination_institution"?: string | null,"direction": Database["public"]['Enums']["document_direction"],"document_type_id"?: string | null,"due_date"?: string | null,"id"?: string,"internal_reference"?: string,"is_demo"?: boolean,"issued_on"?: string | null,"next_action"?: string | null,"observations"?: string | null,"official_number"?: string | null,"origin_department_id"?: string | null,"priority_code"?: string,"received_at_decanato_at"?: string | null,"received_at_di_at"?: string | null,"received_by_name"?: string | null,"received_on"?: string | null,"recipient_department_id"?: string | null,"recipient_name"?: string | null,"registered_at"?: string,"remitted_to_decanato_at"?: string | null,"remitted_to_di_at"?: string | null,"responsible_id"?: string | null,"search_text"?: never,"sender_institution"?: string | null,"sender_name"?: string | null,"stage_changed_at"?: string,"status"?: Database["public"]['Enums']["document_status"],"subject": string,"updated_at"?: string,"updated_by"?: string | null,"visibility"?: Database["public"]['Enums']["document_visibility"]
                  }
                  Update: {
                    "archived_at"?: string | null,"completed_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"current_department_id"?: string,"description"?: string | null,"destination_institution"?: string | null,"direction"?: Database["public"]['Enums']["document_direction"],"document_type_id"?: string | null,"due_date"?: string | null,"id"?: string,"internal_reference"?: string,"is_demo"?: boolean,"issued_on"?: string | null,"next_action"?: string | null,"observations"?: string | null,"official_number"?: string | null,"origin_department_id"?: string | null,"priority_code"?: string,"received_at_decanato_at"?: string | null,"received_at_di_at"?: string | null,"received_by_name"?: string | null,"received_on"?: string | null,"recipient_department_id"?: string | null,"recipient_name"?: string | null,"registered_at"?: string,"remitted_to_decanato_at"?: string | null,"remitted_to_di_at"?: string | null,"responsible_id"?: string | null,"search_text"?: never,"sender_institution"?: string | null,"sender_name"?: string | null,"stage_changed_at"?: string,"status"?: Database["public"]['Enums']["document_status"],"subject"?: string,"updated_at"?: string,"updated_by"?: string | null,"visibility"?: Database["public"]['Enums']["document_visibility"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "documents_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "documents_current_department_id_fkey"
      columns: ["current_department_id"]
isOneToOne: false
      referencedRelation: "departments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "documents_document_type_id_fkey"
      columns: ["document_type_id"]
isOneToOne: false
      referencedRelation: "document_types"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "documents_origin_department_id_fkey"
      columns: ["origin_department_id"]
isOneToOne: false
      referencedRelation: "departments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "documents_priority_code_fkey"
      columns: ["priority_code"]
isOneToOne: false
      referencedRelation: "priorities"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "documents_recipient_department_id_fkey"
      columns: ["recipient_department_id"]
isOneToOne: false
      referencedRelation: "departments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "documents_responsible_id_fkey"
      columns: ["responsible_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "documents_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"notifications": {
                  Row: {
                    "body": string | null,"created_at": string,"dedupe_key": string,"document_id": string | null,"id": string,"kind": string,"link": string | null,"procedure_id": string | null,"read_at": string | null,"recipient_id": string,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body"?: string | null,"created_at"?: string,"dedupe_key": string,"document_id"?: string | null,"id"?: string,"kind": string,"link"?: string | null,"procedure_id"?: string | null,"read_at"?: string | null,"recipient_id": string,"title": string
                  }
                  Update: {
                    "body"?: string | null,"created_at"?: string,"dedupe_key"?: string,"document_id"?: string | null,"id"?: string,"kind"?: string,"link"?: string | null,"procedure_id"?: string | null,"read_at"?: string | null,"recipient_id"?: string,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notifications_document_id_fkey"
      columns: ["document_id"]
isOneToOne: false
      referencedRelation: "document_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_document_id_fkey"
      columns: ["document_id"]
isOneToOne: false
      referencedRelation: "documents"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_procedure_id_fkey"
      columns: ["procedure_id"]
isOneToOne: false
      referencedRelation: "procedure_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_procedure_id_fkey"
      columns: ["procedure_id"]
isOneToOne: false
      referencedRelation: "procedures"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_recipient_id_fkey"
      columns: ["recipient_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"priorities": {
                  Row: {
                    "active": boolean,"code": string,"created_at": string,"name": string,"updated_at": string,"weight": number
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"code": string,"created_at"?: string,"name": string,"updated_at"?: string,"weight": number
                  }
                  Update: {
                    "active"?: boolean,"code"?: string,"created_at"?: string,"name"?: string,"updated_at"?: string,"weight"?: number
                  }
                  Relationships: [
                    
                  ]
                },"procedure_categories": {
                  Row: {
                    "active": boolean,"created_at": string,"description": string | null,"id": string,"name": string,"sort_order": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"created_at"?: string,"description"?: string | null,"id"?: string,"name": string,"sort_order"?: number,"updated_at"?: string
                  }
                  Update: {
                    "active"?: boolean,"created_at"?: string,"description"?: string | null,"id"?: string,"name"?: string,"sort_order"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"procedure_counters": {
                  Row: {
                    "last_value": number,"year": number
                  }
                  ComputedFields: never
                  Insert: {
                    "last_value"?: number,"year": number
                  }
                  Update: {
                    "last_value"?: number,"year"?: number
                  }
                  Relationships: [
                    
                  ]
                },"procedure_events": {
                  Row: {
                    "changes": Json | null,"event_type": Database["public"]['Enums']["procedure_event_type"],"from_responsible_id": string | null,"from_status": Database["public"]['Enums']["procedure_status"] | null,"id": string,"notes": string | null,"occurred_at": string,"procedure_id": string,"recorded_by": string | null,"seq": number,"to_responsible_id": string | null,"to_status": Database["public"]['Enums']["procedure_status"] | null
                  }
                  ComputedFields: never
                  Insert: {
                    "changes"?: Json | null,"event_type": Database["public"]['Enums']["procedure_event_type"],"from_responsible_id"?: string | null,"from_status"?: Database["public"]['Enums']["procedure_status"] | null,"id"?: string,"notes"?: string | null,"occurred_at"?: string,"procedure_id": string,"recorded_by"?: string | null,"seq"?: never,"to_responsible_id"?: string | null,"to_status"?: Database["public"]['Enums']["procedure_status"] | null
                  }
                  Update: {
                    "changes"?: Json | null,"event_type"?: Database["public"]['Enums']["procedure_event_type"],"from_responsible_id"?: string | null,"from_status"?: Database["public"]['Enums']["procedure_status"] | null,"id"?: string,"notes"?: string | null,"occurred_at"?: string,"procedure_id"?: string,"recorded_by"?: string | null,"seq"?: never,"to_responsible_id"?: string | null,"to_status"?: Database["public"]['Enums']["procedure_status"] | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "procedure_events_from_responsible_id_fkey"
      columns: ["from_responsible_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "procedure_events_procedure_id_fkey"
      columns: ["procedure_id"]
isOneToOne: false
      referencedRelation: "procedure_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "procedure_events_procedure_id_fkey"
      columns: ["procedure_id"]
isOneToOne: false
      referencedRelation: "procedures"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "procedure_events_recorded_by_fkey"
      columns: ["recorded_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "procedure_events_to_responsible_id_fkey"
      columns: ["to_responsible_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"procedures": {
                  Row: {
                    "category_id": string | null,"completed_at": string | null,"created_at": string,"created_by": string | null,"description": string | null,"document_id": string | null,"due_date": string | null,"id": string,"is_demo": boolean,"next_action": string | null,"notes": string | null,"priority_code": string,"reference": string,"responsible_department_id": string,"responsible_id": string | null,"search_text": string | null,"start_date": string,"status": Database["public"]['Enums']["procedure_status"],"title": string,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "category_id"?: string | null,"completed_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"description"?: string | null,"document_id"?: string | null,"due_date"?: string | null,"id"?: string,"is_demo"?: boolean,"next_action"?: string | null,"notes"?: string | null,"priority_code"?: string,"reference"?: string,"responsible_department_id": string,"responsible_id"?: string | null,"search_text"?: never,"start_date"?: string,"status"?: Database["public"]['Enums']["procedure_status"],"title": string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "category_id"?: string | null,"completed_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"description"?: string | null,"document_id"?: string | null,"due_date"?: string | null,"id"?: string,"is_demo"?: boolean,"next_action"?: string | null,"notes"?: string | null,"priority_code"?: string,"reference"?: string,"responsible_department_id"?: string,"responsible_id"?: string | null,"search_text"?: never,"start_date"?: string,"status"?: Database["public"]['Enums']["procedure_status"],"title"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "procedures_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "procedure_categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "procedures_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "procedures_document_id_fkey"
      columns: ["document_id"]
isOneToOne: false
      referencedRelation: "document_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "procedures_document_id_fkey"
      columns: ["document_id"]
isOneToOne: false
      referencedRelation: "documents"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "procedures_priority_code_fkey"
      columns: ["priority_code"]
isOneToOne: false
      referencedRelation: "priorities"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "procedures_responsible_department_id_fkey"
      columns: ["responsible_department_id"]
isOneToOne: false
      referencedRelation: "departments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "procedures_responsible_id_fkey"
      columns: ["responsible_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "procedures_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"department_id": string | null,"email": string,"full_name": string,"id": string,"job_title": string | null,"role": Database["public"]['Enums']["app_role"],"status": Database["public"]['Enums']["account_status"],"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"department_id"?: string | null,"email": string,"full_name"?: string,"id": string,"job_title"?: string | null,"role"?: Database["public"]['Enums']["app_role"],"status"?: Database["public"]['Enums']["account_status"],"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"department_id"?: string | null,"email"?: string,"full_name"?: string,"id"?: string,"job_title"?: string | null,"role"?: Database["public"]['Enums']["app_role"],"status"?: Database["public"]['Enums']["account_status"],"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "profiles_department_id_fkey"
      columns: ["department_id"]
isOneToOne: false
      referencedRelation: "departments"
      referencedColumns: ["id"]
    }
                  ]
                },"project_documents": {
                  Row: {
                    "created_at": string,"created_by": string | null,"due_date": string | null,"id": string,"kind": Database["public"]['Enums']["project_document_kind"],"notes": string | null,"priority_code": string,"project_id": string,"reference": string | null,"status": Database["public"]['Enums']["project_document_status"],"status_changed_at": string,"title": string,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"due_date"?: string | null,"id"?: string,"kind": Database["public"]['Enums']["project_document_kind"],"notes"?: string | null,"priority_code"?: string,"project_id": string,"reference"?: string | null,"status"?: Database["public"]['Enums']["project_document_status"],"status_changed_at"?: string,"title": string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"due_date"?: string | null,"id"?: string,"kind"?: Database["public"]['Enums']["project_document_kind"],"notes"?: string | null,"priority_code"?: string,"project_id"?: string,"reference"?: string | null,"status"?: Database["public"]['Enums']["project_document_status"],"status_changed_at"?: string,"title"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "project_documents_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "project_documents_priority_code_fkey"
      columns: ["priority_code"]
isOneToOne: false
      referencedRelation: "priorities"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "project_documents_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "project_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "project_documents_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "project_documents_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"project_events": {
                  Row: {
                    "changes": Json | null,"event_type": Database["public"]['Enums']["project_event_type"],"file_id": string | null,"from_status": string | null,"id": string,"is_internal": boolean,"notes": string | null,"occurred_at": string,"project_document_id": string | null,"project_id": string,"recorded_by": string | null,"seq": number,"to_status": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "changes"?: Json | null,"event_type": Database["public"]['Enums']["project_event_type"],"file_id"?: string | null,"from_status"?: string | null,"id"?: string,"is_internal"?: boolean,"notes"?: string | null,"occurred_at"?: string,"project_document_id"?: string | null,"project_id": string,"recorded_by"?: string | null,"seq"?: never,"to_status"?: string | null
                  }
                  Update: {
                    "changes"?: Json | null,"event_type"?: Database["public"]['Enums']["project_event_type"],"file_id"?: string | null,"from_status"?: string | null,"id"?: string,"is_internal"?: boolean,"notes"?: string | null,"occurred_at"?: string,"project_document_id"?: string | null,"project_id"?: string,"recorded_by"?: string | null,"seq"?: never,"to_status"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "project_events_file_id_fkey"
      columns: ["file_id"]
isOneToOne: false
      referencedRelation: "project_file_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "project_events_file_id_fkey"
      columns: ["file_id"]
isOneToOne: false
      referencedRelation: "project_files"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "project_events_project_document_id_fkey"
      columns: ["project_document_id"]
isOneToOne: false
      referencedRelation: "project_document_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "project_events_project_document_id_fkey"
      columns: ["project_document_id"]
isOneToOne: false
      referencedRelation: "project_documents"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "project_events_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "project_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "project_events_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "project_events_recorded_by_fkey"
      columns: ["recorded_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"project_files": {
                  Row: {
                    "extension": string,"id": string,"mime_type": string,"original_filename": string,"project_document_id": string,"project_id": string,"removal_reason": string | null,"removed_at": string | null,"removed_by": string | null,"size_bytes": number,"storage_path": string,"uploaded_at": string,"uploaded_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "extension": string,"id"?: string,"mime_type": string,"original_filename": string,"project_document_id": string,"project_id": string,"removal_reason"?: string | null,"removed_at"?: string | null,"removed_by"?: string | null,"size_bytes": number,"storage_path": string,"uploaded_at"?: string,"uploaded_by"?: string | null
                  }
                  Update: {
                    "extension"?: string,"id"?: string,"mime_type"?: string,"original_filename"?: string,"project_document_id"?: string,"project_id"?: string,"removal_reason"?: string | null,"removed_at"?: string | null,"removed_by"?: string | null,"size_bytes"?: number,"storage_path"?: string,"uploaded_at"?: string,"uploaded_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "project_files_project_document_id_fkey"
      columns: ["project_document_id"]
isOneToOne: false
      referencedRelation: "project_document_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "project_files_project_document_id_fkey"
      columns: ["project_document_id"]
isOneToOne: false
      referencedRelation: "project_documents"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "project_files_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "project_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "project_files_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "project_files_removed_by_fkey"
      columns: ["removed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "project_files_uploaded_by_fkey"
      columns: ["uploaded_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"projects": {
                  Row: {
                    "co_investigators": (string)[],"code": string,"created_at": string,"created_by": string | null,"funding_source": string | null,"id": string,"is_demo": boolean,"principal_investigator": string,"search_text": string,"status": Database["public"]['Enums']["project_status"],"status_changed_at": string,"summary": string | null,"title": string,"unit": string,"updated_at": string,"updated_by": string | null,"year": number
                  }
                  ComputedFields: never
                  Insert: {
                    "co_investigators"?: (string)[],"code": string,"created_at"?: string,"created_by"?: string | null,"funding_source"?: string | null,"id"?: string,"is_demo"?: boolean,"principal_investigator": string,"search_text"?: string,"status"?: Database["public"]['Enums']["project_status"],"status_changed_at"?: string,"summary"?: string | null,"title": string,"unit"?: string,"updated_at"?: string,"updated_by"?: string | null,"year"?: number
                  }
                  Update: {
                    "co_investigators"?: (string)[],"code"?: string,"created_at"?: string,"created_by"?: string | null,"funding_source"?: string | null,"id"?: string,"is_demo"?: boolean,"principal_investigator"?: string,"search_text"?: string,"status"?: Database["public"]['Enums']["project_status"],"status_changed_at"?: string,"summary"?: string | null,"title"?: string,"unit"?: string,"updated_at"?: string,"updated_by"?: string | null,"year"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "projects_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "projects_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "document_overview": {
                  Row: {
                    "archived_at": string | null,"awaiting_handoff": boolean | null,"completed_at": string | null,"created_at": string | null,"created_by": string | null,"created_by_name": string | null,"current_department_code": string | null,"current_department_id": string | null,"current_department_name": string | null,"current_department_short_name": string | null,"days_to_due": number | null,"description": string | null,"destination_institution": string | null,"direction": Database["public"]['Enums']["document_direction"] | null,"document_type_id": string | null,"document_type_name": string | null,"due_date": string | null,"id": string | null,"internal_reference": string | null,"is_archived": boolean | null,"is_due_soon": boolean | null,"is_open": boolean | null,"is_overdue": boolean | null,"is_stale": boolean | null,"issued_on": string | null,"next_action": string | null,"observations": string | null,"official_number": string | null,"origin_department_id": string | null,"priority_code": string | null,"priority_name": string | null,"priority_weight": number | null,"received_at_decanato_at": string | null,"received_at_di_at": string | null,"received_by_name": string | null,"received_on": string | null,"recipient_department_id": string | null,"recipient_department_name": string | null,"recipient_name": string | null,"registered_at": string | null,"remitted_to_decanato_at": string | null,"remitted_to_di_at": string | null,"responsible_id": string | null,"responsible_name": string | null,"search_text": string | null,"sender_institution": string | null,"sender_name": string | null,"stage_changed_at": string | null,"status": Database["public"]['Enums']["document_status"] | null,"subject": string | null,"updated_at": string | null,"updated_by": string | null,"updated_by_name": string | null,"visibility": Database["public"]['Enums']["document_visibility"] | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "documents_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "documents_current_department_id_fkey"
      columns: ["current_department_id"]
isOneToOne: false
      referencedRelation: "departments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "documents_document_type_id_fkey"
      columns: ["document_type_id"]
isOneToOne: false
      referencedRelation: "document_types"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "documents_origin_department_id_fkey"
      columns: ["origin_department_id"]
isOneToOne: false
      referencedRelation: "departments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "documents_priority_code_fkey"
      columns: ["priority_code"]
isOneToOne: false
      referencedRelation: "priorities"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "documents_recipient_department_id_fkey"
      columns: ["recipient_department_id"]
isOneToOne: false
      referencedRelation: "departments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "documents_responsible_id_fkey"
      columns: ["responsible_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "documents_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"procedure_event_overview": {
                  Row: {
                    "changes": Json | null,"event_type": Database["public"]['Enums']["procedure_event_type"] | null,"from_responsible_id": string | null,"from_responsible_name": string | null,"from_status": Database["public"]['Enums']["procedure_status"] | null,"id": string | null,"notes": string | null,"occurred_at": string | null,"procedure_id": string | null,"procedure_reference": string | null,"procedure_title": string | null,"recorded_by": string | null,"recorded_by_name": string | null,"seq": number | null,"to_responsible_id": string | null,"to_responsible_name": string | null,"to_status": Database["public"]['Enums']["procedure_status"] | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "procedure_events_from_responsible_id_fkey"
      columns: ["from_responsible_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "procedure_events_procedure_id_fkey"
      columns: ["procedure_id"]
isOneToOne: false
      referencedRelation: "procedure_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "procedure_events_procedure_id_fkey"
      columns: ["procedure_id"]
isOneToOne: false
      referencedRelation: "procedures"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "procedure_events_recorded_by_fkey"
      columns: ["recorded_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "procedure_events_to_responsible_id_fkey"
      columns: ["to_responsible_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"procedure_overview": {
                  Row: {
                    "category_id": string | null,"category_name": string | null,"completed_at": string | null,"created_at": string | null,"created_by": string | null,"created_by_name": string | null,"days_to_due": number | null,"description": string | null,"document_direction": Database["public"]['Enums']["document_direction"] | null,"document_id": string | null,"document_reference": string | null,"document_subject": string | null,"due_date": string | null,"id": string | null,"is_due_soon": boolean | null,"is_open": boolean | null,"is_overdue": boolean | null,"next_action": string | null,"notes": string | null,"priority_code": string | null,"priority_name": string | null,"priority_weight": number | null,"reference": string | null,"responsible_department_code": string | null,"responsible_department_id": string | null,"responsible_department_name": string | null,"responsible_department_short_name": string | null,"responsible_id": string | null,"responsible_name": string | null,"search_text": string | null,"start_date": string | null,"status": Database["public"]['Enums']["procedure_status"] | null,"title": string | null,"updated_at": string | null,"updated_by": string | null,"updated_by_name": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "procedures_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "procedure_categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "procedures_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "procedures_document_id_fkey"
      columns: ["document_id"]
isOneToOne: false
      referencedRelation: "document_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "procedures_document_id_fkey"
      columns: ["document_id"]
isOneToOne: false
      referencedRelation: "documents"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "procedures_priority_code_fkey"
      columns: ["priority_code"]
isOneToOne: false
      referencedRelation: "priorities"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "procedures_responsible_department_id_fkey"
      columns: ["responsible_department_id"]
isOneToOne: false
      referencedRelation: "departments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "procedures_responsible_id_fkey"
      columns: ["responsible_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "procedures_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"project_document_overview": {
                  Row: {
                    "created_at": string | null,"created_by": string | null,"created_by_name": string | null,"days_to_due": number | null,"due_date": string | null,"files_count": number | null,"id": string | null,"is_due_soon": boolean | null,"is_overdue": boolean | null,"is_pending": boolean | null,"is_pending_signature": boolean | null,"is_priority": boolean | null,"kind": Database["public"]['Enums']["project_document_kind"] | null,"notes": string | null,"priority_code": string | null,"priority_name": string | null,"priority_weight": number | null,"project_code": string | null,"project_id": string | null,"project_title": string | null,"reference": string | null,"status": Database["public"]['Enums']["project_document_status"] | null,"status_changed_at": string | null,"title": string | null,"updated_at": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "project_documents_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "project_documents_priority_code_fkey"
      columns: ["priority_code"]
isOneToOne: false
      referencedRelation: "priorities"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "project_documents_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "project_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "project_documents_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    }
                  ]
                },"project_event_overview": {
                  Row: {
                    "changes": Json | null,"document_kind": Database["public"]['Enums']["project_document_kind"] | null,"document_title": string | null,"event_type": Database["public"]['Enums']["project_event_type"] | null,"file_id": string | null,"from_status": string | null,"id": string | null,"is_internal": boolean | null,"notes": string | null,"occurred_at": string | null,"project_document_id": string | null,"project_id": string | null,"recorded_by": string | null,"recorded_by_name": string | null,"seq": number | null,"to_status": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "project_events_file_id_fkey"
      columns: ["file_id"]
isOneToOne: false
      referencedRelation: "project_file_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "project_events_file_id_fkey"
      columns: ["file_id"]
isOneToOne: false
      referencedRelation: "project_files"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "project_events_project_document_id_fkey"
      columns: ["project_document_id"]
isOneToOne: false
      referencedRelation: "project_document_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "project_events_project_document_id_fkey"
      columns: ["project_document_id"]
isOneToOne: false
      referencedRelation: "project_documents"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "project_events_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "project_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "project_events_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "project_events_recorded_by_fkey"
      columns: ["recorded_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"project_file_overview": {
                  Row: {
                    "extension": string | null,"id": string | null,"original_filename": string | null,"project_document_id": string | null,"project_id": string | null,"removal_reason": string | null,"removed_at": string | null,"size_bytes": number | null,"uploaded_at": string | null,"uploaded_by": string | null,"uploaded_by_name": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "project_files_project_document_id_fkey"
      columns: ["project_document_id"]
isOneToOne: false
      referencedRelation: "project_document_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "project_files_project_document_id_fkey"
      columns: ["project_document_id"]
isOneToOne: false
      referencedRelation: "project_documents"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "project_files_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "project_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "project_files_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "project_files_uploaded_by_fkey"
      columns: ["uploaded_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"project_overview": {
                  Row: {
                    "co_investigators": (string)[] | null,"code": string | null,"created_at": string | null,"created_by": string | null,"created_by_name": string | null,"documents_due_soon": number | null,"documents_overdue": number | null,"documents_pending": number | null,"documents_pending_signature": number | null,"documents_priority": number | null,"documents_total": number | null,"funding_source": string | null,"has_alerts": boolean | null,"id": string | null,"is_approved": boolean | null,"principal_investigator": string | null,"search_text": string | null,"status": Database["public"]['Enums']["project_status"] | null,"status_changed_at": string | null,"summary": string | null,"title": string | null,"unit": string | null,"updated_at": string | null,"updated_by": string | null,"updated_by_name": string | null,"year": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "projects_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "projects_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"route_event_overview": {
                  Row: {
                    "action": string | null,"attachment_id": string | null,"created_at": string | null,"document_direction": Database["public"]['Enums']["document_direction"] | null,"document_id": string | null,"document_internal_reference": string | null,"document_official_number": string | null,"document_subject": string | null,"event_type": Database["public"]['Enums']["route_event_type"] | null,"from_department_id": string | null,"from_department_name": string | null,"from_department_short_name": string | null,"from_responsible_id": string | null,"from_status": Database["public"]['Enums']["document_status"] | null,"id": string | null,"is_reversed": boolean | null,"notes": string | null,"occurred_at": string | null,"recorded_by": string | null,"recorded_by_email": string | null,"recorded_by_name": string | null,"reverses_event_id": string | null,"seq": number | null,"to_department_id": string | null,"to_department_name": string | null,"to_department_short_name": string | null,"to_responsible_id": string | null,"to_responsible_name": string | null,"to_status": Database["public"]['Enums']["document_status"] | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "document_route_events_attachment_id_fkey"
      columns: ["attachment_id"]
isOneToOne: false
      referencedRelation: "document_attachments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "document_route_events_document_id_fkey"
      columns: ["document_id"]
isOneToOne: false
      referencedRelation: "document_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "document_route_events_document_id_fkey"
      columns: ["document_id"]
isOneToOne: false
      referencedRelation: "documents"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "document_route_events_from_department_id_fkey"
      columns: ["from_department_id"]
isOneToOne: false
      referencedRelation: "departments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "document_route_events_from_responsible_id_fkey"
      columns: ["from_responsible_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "document_route_events_recorded_by_fkey"
      columns: ["recorded_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "document_route_events_reverses_event_id_fkey"
      columns: ["reverses_event_id"]
isOneToOne: true
      referencedRelation: "document_route_events"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "document_route_events_reverses_event_id_fkey"
      columns: ["reverses_event_id"]
isOneToOne: true
      referencedRelation: "route_event_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "document_route_events_to_department_id_fkey"
      columns: ["to_department_id"]
isOneToOne: false
      referencedRelation: "departments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "document_route_events_to_responsible_id_fkey"
      columns: ["to_responsible_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Functions: {
            "add_document_observation":
{ Args: { "p_attachment_id"?: string,"p_document_id": string,"p_notes": string }; Returns: {
              "action": string,
"attachment_id": string | null,
"created_at": string,
"document_id": string,
"event_type": Database["public"]['Enums']["route_event_type"],
"from_department_id": string | null,
"from_responsible_id": string | null,
"from_status": Database["public"]['Enums']["document_status"] | null,
"id": string,
"notes": string | null,
"occurred_at": string,
"recorded_by": string | null,
"reverses_event_id": string | null,
"seq": number,
"to_department_id": string | null,
"to_responsible_id": string | null,
"to_status": Database["public"]['Enums']["document_status"] | null
            }
                          SetofOptions: {
        from: "*"
        to: "document_route_events"
        isOneToOne: true
        isSetofReturn: false
      } },
"add_procedure_observation":
{ Args: { "p_notes": string,"p_procedure_id": string }; Returns: {
              "changes": Json | null,
"event_type": Database["public"]['Enums']["procedure_event_type"],
"from_responsible_id": string | null,
"from_status": Database["public"]['Enums']["procedure_status"] | null,
"id": string,
"notes": string | null,
"occurred_at": string,
"procedure_id": string,
"recorded_by": string | null,
"seq": number,
"to_responsible_id": string | null,
"to_status": Database["public"]['Enums']["procedure_status"] | null
            }
                          SetofOptions: {
        from: "*"
        to: "procedure_events"
        isOneToOne: true
        isSetofReturn: false
      } },
"add_project_note":
{ Args: { "p_document_id"?: string,"p_internal"?: boolean,"p_notes": string,"p_project_id": string }; Returns: {
              "changes": Json | null,
"event_type": Database["public"]['Enums']["project_event_type"],
"file_id": string | null,
"from_status": string | null,
"id": string,
"is_internal": boolean,
"notes": string | null,
"occurred_at": string,
"project_document_id": string | null,
"project_id": string,
"recorded_by": string | null,
"seq": number,
"to_status": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "project_events"
        isOneToOne: true
        isSetofReturn: false
      } },
"admin_set_user_role":
{ Args: { "p_role": Database["public"]['Enums']["app_role"],"p_user_id": string }; Returns: {
              "created_at": string,
"department_id": string | null,
"email": string,
"full_name": string,
"id": string,
"job_title": string | null,
"role": Database["public"]['Enums']["app_role"],
"status": Database["public"]['Enums']["account_status"],
"updated_at": string,
"updated_by": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "profiles"
        isOneToOne: true
        isSetofReturn: false
      } },
"admin_set_user_status":
{ Args: { "p_status": Database["public"]['Enums']["account_status"],"p_user_id": string }; Returns: {
              "created_at": string,
"department_id": string | null,
"email": string,
"full_name": string,
"id": string,
"job_title": string | null,
"role": Database["public"]['Enums']["app_role"],
"status": Database["public"]['Enums']["account_status"],
"updated_at": string,
"updated_by": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "profiles"
        isOneToOne: true
        isSetofReturn: false
      } },
"admin_update_user_profile":
{ Args: { "p_department_id"?: string,"p_full_name": string,"p_job_title": string,"p_user_id": string }; Returns: {
              "created_at": string,
"department_id": string | null,
"email": string,
"full_name": string,
"id": string,
"job_title": string | null,
"role": Database["public"]['Enums']["app_role"],
"status": Database["public"]['Enums']["account_status"],
"updated_at": string,
"updated_by": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "profiles"
        isOneToOne: true
        isSetofReturn: false
      } },
"bootstrap_first_admin":
{ Args: { "p_email": string }; Returns: {
              "created_at": string,
"department_id": string | null,
"email": string,
"full_name": string,
"id": string,
"job_title": string | null,
"role": Database["public"]['Enums']["app_role"],
"status": Database["public"]['Enums']["account_status"],
"updated_at": string,
"updated_by": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "profiles"
        isOneToOne: true
        isSetofReturn: false
      } },
"change_procedure_status":
{ Args: { "p_notes"?: string,"p_procedure_id": string,"p_status": Database["public"]['Enums']["procedure_status"] }; Returns: {
              "category_id": string | null,
"completed_at": string | null,
"created_at": string,
"created_by": string | null,
"description": string | null,
"document_id": string | null,
"due_date": string | null,
"id": string,
"is_demo": boolean,
"next_action": string | null,
"notes": string | null,
"priority_code": string,
"reference": string,
"responsible_department_id": string,
"responsible_id": string | null,
"search_text": string | null,
"start_date": string,
"status": Database["public"]['Enums']["procedure_status"],
"title": string,
"updated_at": string,
"updated_by": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "procedures"
        isOneToOne: true
        isSetofReturn: false
      } },
"change_project_document_status":
{ Args: { "p_document_id": string,"p_notes"?: string,"p_status": Database["public"]['Enums']["project_document_status"] }; Returns: {
              "created_at": string,
"created_by": string | null,
"due_date": string | null,
"id": string,
"kind": Database["public"]['Enums']["project_document_kind"],
"notes": string | null,
"priority_code": string,
"project_id": string,
"reference": string | null,
"status": Database["public"]['Enums']["project_document_status"],
"status_changed_at": string,
"title": string,
"updated_at": string,
"updated_by": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "project_documents"
        isOneToOne: true
        isSetofReturn: false
      } },
"change_project_status":
{ Args: { "p_notes"?: string,"p_project_id": string,"p_status": Database["public"]['Enums']["project_status"] }; Returns: {
              "co_investigators": (string)[],
"code": string,
"created_at": string,
"created_by": string | null,
"funding_source": string | null,
"id": string,
"is_demo": boolean,
"principal_investigator": string,
"search_text": string,
"status": Database["public"]['Enums']["project_status"],
"status_changed_at": string,
"summary": string | null,
"title": string,
"unit": string,
"updated_at": string,
"updated_by": string | null,
"year": number
            }
                          SetofOptions: {
        from: "*"
        to: "projects"
        isOneToOne: true
        isSetofReturn: false
      } },
"dashboard_summary":
{ Args: { "p_from"?: string,"p_to"?: string }; Returns: Json
                           },
"get_outgoing_route_definition":
{ Args: Record<PropertyKey, never>; Returns: {
              "action_label": string,"destination_code": string,"from_status": Database["public"]['Enums']["document_status"],"origin_code": string,"required_prior_status": Database["public"]['Enums']["document_status"],"to_status": Database["public"]['Enums']["document_status"]
            }[]
                           },
"is_incoming_status":
{ Args: { "p_status": Database["public"]['Enums']["document_status"] }; Returns: boolean
                           },
"is_outgoing_status":
{ Args: { "p_status": Database["public"]['Enums']["document_status"] }; Returns: boolean
                           },
"log_report_export":
{ Args: { "p_filters": Json,"p_format": string,"p_report": string,"p_rows": number }; Returns: undefined
                           },
"mark_all_notifications_read":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"normalize_search":
{ Args: { "p_text": string }; Returns: string
                           },
"outgoing_stage_department_code":
{ Args: { "p_status": Database["public"]['Enums']["document_status"] }; Returns: string
                           },
"outgoing_transition_rule":
{ Args: { "p_from": Database["public"]['Enums']["document_status"],"p_to": Database["public"]['Enums']["document_status"] }; Returns: {
              "action_label": string,"destination_code": string,"origin_code": string,"required_prior_status": Database["public"]['Enums']["document_status"]
            }[]
                           },
"purge_demo_data":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"record_incoming_movement":
{ Args: { "p_attachment_id"?: string,"p_document_id": string,"p_expected_status": Database["public"]['Enums']["document_status"],"p_notes"?: string,"p_to_department_id"?: string,"p_to_status": Database["public"]['Enums']["document_status"] }; Returns: {
              "action": string,
"attachment_id": string | null,
"created_at": string,
"document_id": string,
"event_type": Database["public"]['Enums']["route_event_type"],
"from_department_id": string | null,
"from_responsible_id": string | null,
"from_status": Database["public"]['Enums']["document_status"] | null,
"id": string,
"notes": string | null,
"occurred_at": string,
"recorded_by": string | null,
"reverses_event_id": string | null,
"seq": number,
"to_department_id": string | null,
"to_responsible_id": string | null,
"to_status": Database["public"]['Enums']["document_status"] | null
            }
                          SetofOptions: {
        from: "*"
        to: "document_route_events"
        isOneToOne: true
        isSetofReturn: false
      } },
"record_outgoing_transition":
{ Args: { "p_attachment_id"?: string,"p_document_id": string,"p_expected_status": Database["public"]['Enums']["document_status"],"p_notes"?: string,"p_to_status": Database["public"]['Enums']["document_status"] }; Returns: {
              "action": string,
"attachment_id": string | null,
"created_at": string,
"document_id": string,
"event_type": Database["public"]['Enums']["route_event_type"],
"from_department_id": string | null,
"from_responsible_id": string | null,
"from_status": Database["public"]['Enums']["document_status"] | null,
"id": string,
"notes": string | null,
"occurred_at": string,
"recorded_by": string | null,
"reverses_event_id": string | null,
"seq": number,
"to_department_id": string | null,
"to_responsible_id": string | null,
"to_status": Database["public"]['Enums']["document_status"] | null
            }
                          SetofOptions: {
        from: "*"
        to: "document_route_events"
        isOneToOne: true
        isSetofReturn: false
      } },
"refresh_deadline_notifications":
{ Args: { "p_force"?: boolean }; Returns: number
                           },
"remove_attachment":
{ Args: { "p_attachment_id": string,"p_reason": string }; Returns: {
              "description": string | null,
"document_id": string,
"extension": string,
"id": string,
"mime_type": string,
"original_filename": string,
"removal_reason": string | null,
"removed_at": string | null,
"removed_by": string | null,
"replaces_attachment_id": string | null,
"size_bytes": number,
"storage_path": string,
"uploaded_at": string,
"uploaded_by": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "document_attachments"
        isOneToOne: true
        isSetofReturn: false
      } },
"remove_project_file":
{ Args: { "p_file_id": string,"p_reason": string }; Returns: {
              "extension": string,
"id": string,
"mime_type": string,
"original_filename": string,
"project_document_id": string,
"project_id": string,
"removal_reason": string | null,
"removed_at": string | null,
"removed_by": string | null,
"size_bytes": number,
"storage_path": string,
"uploaded_at": string,
"uploaded_by": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "project_files"
        isOneToOne: true
        isSetofReturn: false
      } },
"reverse_last_movement":
{ Args: { "p_document_id": string,"p_expected_status": Database["public"]['Enums']["document_status"],"p_reason": string }; Returns: {
              "action": string,
"attachment_id": string | null,
"created_at": string,
"document_id": string,
"event_type": Database["public"]['Enums']["route_event_type"],
"from_department_id": string | null,
"from_responsible_id": string | null,
"from_status": Database["public"]['Enums']["document_status"] | null,
"id": string,
"notes": string | null,
"occurred_at": string,
"recorded_by": string | null,
"reverses_event_id": string | null,
"seq": number,
"to_department_id": string | null,
"to_responsible_id": string | null,
"to_status": Database["public"]['Enums']["document_status"] | null
            }
                          SetofOptions: {
        from: "*"
        to: "document_route_events"
        isOneToOne: true
        isSetofReturn: false
      } },
"update_my_profile":
{ Args: { "p_full_name": string,"p_job_title": string }; Returns: {
              "created_at": string,
"department_id": string | null,
"email": string,
"full_name": string,
"id": string,
"job_title": string | null,
"role": Database["public"]['Enums']["app_role"],
"status": Database["public"]['Enums']["account_status"],
"updated_at": string,
"updated_by": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "profiles"
        isOneToOne: true
        isSetofReturn: false
      } }
          }
          Enums: {
            "account_status": "ACTIVO"|"SUSPENDIDO","app_role": "ADMINISTRADOR"|"CONSULTA","document_direction": "ENTRANTE"|"SALIENTE","document_status": "REGISTRADO_EN_INEDUC"|"REMITIDO_A_DIRECCION_INVESTIGACION"|"RECIBIDO_EN_DIRECCION_INVESTIGACION"|"EN_GESTION_DIRECCION_INVESTIGACION"|"REMITIDO_DESDE_DIRECCION_INVESTIGACION_A_DECANATO"|"RECIBIDO_EN_DECANATO"|"RECIBIDO"|"EN_REVISION"|"EN_TRAMITE"|"REMITIDO"|"EN_ESPERA_RESPUESTA"|"EN_SEGUIMIENTO"|"COMPLETADO"|"ARCHIVADO","document_visibility": "GENERAL"|"RESTRINGIDO","procedure_event_type": "CREACION"|"CAMBIO_ESTADO"|"REASIGNACION"|"OBSERVACION"|"ACTUALIZACION","procedure_status": "PENDIENTE"|"EN_PROCESO"|"EN_REVISION"|"EN_ESPERA_RESPUESTA"|"COMPLETADO"|"CANCELADO","project_document_kind": "OFICIO"|"PROPUESTA"|"INFORME_AVANCE"|"INFORME_FINAL"|"PRESUPUESTO"|"AVAL_ETICO"|"CARTA_INSTITUCIONAL"|"OTRO","project_document_status": "INGRESADO"|"EN_REVISION"|"PENDIENTE_FIRMA"|"ENVIADO_A_VIA"|"DEVUELTO"|"APROBADO"|"COMPLETADO","project_event_type": "CREACION"|"CAMBIO_ESTADO"|"ACTUALIZACION"|"DOCUMENTO_REGISTRADO"|"DOCUMENTO_ESTADO"|"ARCHIVO_CARGADO"|"ARCHIVO_RETIRADO"|"OBSERVACION","project_status": "EN_FORMULACION"|"EN_TRAMITE"|"APROBADO"|"EN_EJECUCION"|"FINALIZADO"|"RECHAZADO"|"CANCELADO","route_event_type": "REGISTRO"|"TRANSICION"|"MOVIMIENTO"|"OBSERVACION"|"ASIGNACION"|"REVERSION"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            "account_status": ["ACTIVO", "SUSPENDIDO"],"app_role": ["ADMINISTRADOR", "CONSULTA"],"document_direction": ["ENTRANTE", "SALIENTE"],"document_status": ["REGISTRADO_EN_INEDUC", "REMITIDO_A_DIRECCION_INVESTIGACION", "RECIBIDO_EN_DIRECCION_INVESTIGACION", "EN_GESTION_DIRECCION_INVESTIGACION", "REMITIDO_DESDE_DIRECCION_INVESTIGACION_A_DECANATO", "RECIBIDO_EN_DECANATO", "RECIBIDO", "EN_REVISION", "EN_TRAMITE", "REMITIDO", "EN_ESPERA_RESPUESTA", "EN_SEGUIMIENTO", "COMPLETADO", "ARCHIVADO"],"document_visibility": ["GENERAL", "RESTRINGIDO"],"procedure_event_type": ["CREACION", "CAMBIO_ESTADO", "REASIGNACION", "OBSERVACION", "ACTUALIZACION"],"procedure_status": ["PENDIENTE", "EN_PROCESO", "EN_REVISION", "EN_ESPERA_RESPUESTA", "COMPLETADO", "CANCELADO"],"project_document_kind": ["OFICIO", "PROPUESTA", "INFORME_AVANCE", "INFORME_FINAL", "PRESUPUESTO", "AVAL_ETICO", "CARTA_INSTITUCIONAL", "OTRO"],"project_document_status": ["INGRESADO", "EN_REVISION", "PENDIENTE_FIRMA", "ENVIADO_A_VIA", "DEVUELTO", "APROBADO", "COMPLETADO"],"project_event_type": ["CREACION", "CAMBIO_ESTADO", "ACTUALIZACION", "DOCUMENTO_REGISTRADO", "DOCUMENTO_ESTADO", "ARCHIVO_CARGADO", "ARCHIVO_RETIRADO", "OBSERVACION"],"project_status": ["EN_FORMULACION", "EN_TRAMITE", "APROBADO", "EN_EJECUCION", "FINALIZADO", "RECHAZADO", "CANCELADO"],"route_event_type": ["REGISTRO", "TRANSICION", "MOVIMIENTO", "OBSERVACION", "ASIGNACION", "REVERSION"]
          }
        }
} as const
