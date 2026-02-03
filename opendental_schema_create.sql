-- OpenDental schema (tables only, best-effort from documentation XML)

CREATE TABLE [account] (
  [AccountNum] bigint,
  [Description] varchar(255),
  [AcctType] tinyint,
  [BankNumber] varchar(255),
  [Inactive] tinyint,
  [AccountColor] int,
  [IsRetainedEarnings] tinyint,
  PRIMARY KEY ([AccountNum])
);
GO

CREATE TABLE [alertcategory] (
  [AlertCategoryNum] bigint,
  [IsHQCategory] tinyint,
  [InternalName] varchar(255),
  [Description] varchar(255),
  PRIMARY KEY ([AlertCategoryNum])
);
GO

CREATE TABLE [apikey] (
  [APIKeyNum] bigint,
  [CustApiKey] varchar(255),
  [DevName] varchar(255),
  PRIMARY KEY ([APIKeyNum])
);
GO

CREATE TABLE [apisubscription] (
  [ApiSubscriptionNum] bigint,
  [EndPointUrl] varchar(255),
  [Workstation] varchar(255),
  [CustomerKey] varchar(255),
  [WatchTable] varchar(255),
  [PollingSeconds] int,
  [UiEventType] varchar(255),
  [DateTimeStart] datetime,
  [DateTimeStop] datetime,
  [Note] varchar(255),
  PRIMARY KEY ([ApiSubscriptionNum])
);
GO

CREATE TABLE [appointmentrule] (
  [AppointmentRuleNum] bigint,
  [RuleDesc] varchar(255),
  [CodeStart] varchar(15),
  [CodeEnd] varchar(15),
  [IsEnabled] tinyint,
  PRIMARY KEY ([AppointmentRuleNum])
);
GO

CREATE TABLE [appointmenttype] (
  [AppointmentTypeNum] bigint,
  [AppointmentTypeName] varchar(255),
  [AppointmentTypeColor] int,
  [ItemOrder] int,
  [IsHidden] tinyint,
  [Pattern] varchar(255),
  [CodeStr] varchar(4000),
  [CodeStrRequired] varchar(4000),
  [RequiredProcCodesNeeded] tinyint,
  [BlockoutTypes] varchar(255),
  PRIMARY KEY ([AppointmentTypeNum])
);
GO

CREATE TABLE [apptfielddef] (
  [ApptFieldDefNum] bigint,
  [FieldName] varchar(255),
  [FieldType] tinyint,
  [PickList] varchar(max),
  [ItemOrder] int,
  PRIMARY KEY ([ApptFieldDefNum]),
  UNIQUE ([FieldName])
);
GO

CREATE TABLE [autocode] (
  [AutoCodeNum] bigint,
  [Description] varchar(255),
  [IsHidden] tinyint,
  [LessIntrusive] tinyint,
  PRIMARY KEY ([AutoCodeNum])
);
GO

CREATE TABLE [autocommexcludedate] (
  [AutoCommExcludeDateNum] bigint,
  [ClinicNum] bigint,
  [DateExclude] datetime,
  PRIMARY KEY ([AutoCommExcludeDateNum])
);
GO

CREATE TABLE [autonotecontrol] (
  [AutoNoteControlNum] bigint,
  [Descript] varchar(50),
  [ControlType] varchar(50),
  [ControlLabel] varchar(255),
  [ControlOptions] varchar(max),
  PRIMARY KEY ([AutoNoteControlNum])
);
GO

CREATE TABLE [canadiannetwork] (
  [CanadianNetworkNum] bigint,
  [Abbrev] varchar(20),
  [Descript] varchar(255),
  [CanadianTransactionPrefix] varchar(255),
  [CanadianIsRprHandler] tinyint,
  PRIMARY KEY ([CanadianNetworkNum])
);
GO

CREATE TABLE [cdcrec] (
  [CdcrecNum] bigint,
  [CdcrecCode] varchar(255),
  [HeirarchicalCode] varchar(255),
  [Description] varchar(255),
  PRIMARY KEY ([CdcrecNum]),
  UNIQUE ([CdcrecCode])
);
GO

CREATE TABLE [centralconnection] (
  [CentralConnectionNum] bigint,
  [ServerName] varchar(255),
  [DatabaseName] varchar(255),
  [MySqlUser] varchar(255),
  [MySqlPassword] varchar(255),
  [ServiceURI] varchar(255),
  [OdUser] varchar(255),
  [OdPassword] varchar(255),
  [Note] varchar(max),
  [ItemOrder] int,
  [WebServiceIsEcw] tinyint,
  [ConnectionStatus] varchar(255),
  [HasClinicBreakdownReports] tinyint,
  PRIMARY KEY ([CentralConnectionNum])
);
GO

CREATE TABLE [chartview] (
  [ChartViewNum] bigint,
  [Description] varchar(255),
  [ItemOrder] int,
  [ProcStatuses] tinyint,
  [ObjectTypes] smallint,
  [ShowProcNotes] tinyint,
  [IsAudit] tinyint,
  [SelectedTeethOnly] tinyint,
  [OrionStatusFlags] int,
  [DatesShowing] tinyint,
  [IsTpCharting] tinyint,
  PRIMARY KEY ([ChartViewNum])
);
GO

CREATE TABLE [chat] (
  [ChatNum] bigint,
  [Name] varchar(255),
  PRIMARY KEY ([ChatNum])
);
GO

CREATE TABLE [claimform] (
  [ClaimFormNum] bigint,
  [Description] varchar(50),
  [IsHidden] tinyint,
  [FontName] varchar(255),
  [FontSize] float,
  [UniqueID] varchar(255),
  [PrintImages] tinyint,
  [OffsetX] smallint,
  [OffsetY] smallint,
  [Width] int,
  [Height] int,
  PRIMARY KEY ([ClaimFormNum])
);
GO

CREATE TABLE [codegroup] (
  [CodeGroupNum] bigint,
  [GroupName] varchar(50),
  [ProcCodes] varchar(max),
  [ItemOrder] int,
  [CodeGroupFixed] tinyint,
  [IsHidden] tinyint,
  [ShowInAgeLimit] tinyint,
  [ShowInFrequency] tinyint,
  [ShowInOther] tinyint,
  PRIMARY KEY ([CodeGroupNum])
);
GO

CREATE TABLE [codesystem] (
  [CodeSystemNum] bigint,
  [CodeSystemName] varchar(255),
  [VersionCur] varchar(255),
  [VersionAvail] varchar(255),
  [HL7OID] varchar(255),
  [Note] varchar(255),
  PRIMARY KEY ([CodeSystemNum]),
  UNIQUE ([CodeSystemName])
);
GO

CREATE TABLE [computer] (
  [ComputerNum] bigint,
  [CompName] varchar(100),
  [LastHeartBeat] datetime,
  PRIMARY KEY ([ComputerNum])
);
GO

CREATE TABLE [connectiongroup] (
  [ConnectionGroupNum] bigint,
  [Description] varchar(255),
  PRIMARY KEY ([ConnectionGroupNum])
);
GO

CREATE TABLE [county] (
  [CountyNum] bigint,
  [CountyName] varchar(255),
  [CountyCode] varchar(255),
  PRIMARY KEY ([CountyNum]),
  UNIQUE ([CountyName])
);
GO

CREATE TABLE [covcat] (
  [CovCatNum] bigint,
  [Description] varchar(50),
  [DefaultPercent] smallint,
  [CovOrder] int,
  [IsHidden] tinyint,
  [EbenefitCat] tinyint,
  PRIMARY KEY ([CovCatNum])
);
GO

CREATE TABLE [cpt] (
  [CptNum] bigint,
  [CptCode] varchar(255),
  [Description] varchar(4000),
  [VersionIDs] varchar(255),
  PRIMARY KEY ([CptNum])
);
GO

CREATE TABLE [cvx] (
  [CvxNum] bigint,
  [CvxCode] varchar(255),
  [Description] varchar(255),
  [IsActive] varchar(255),
  PRIMARY KEY ([CvxNum])
);
GO

CREATE TABLE [dashboardar] (
  [DashboardARNum] bigint,
  [DateCalc] date,
  [BalTotal] float,
  [InsEst] float,
  PRIMARY KEY ([DashboardARNum])
);
GO

CREATE TABLE [databasemaintenance] (
  [DatabaseMaintenanceNum] bigint,
  [MethodName] varchar(255),
  [IsHidden] tinyint,
  [IsOld] tinyint,
  [DateLastRun] datetime,
  PRIMARY KEY ([DatabaseMaintenanceNum])
);
GO

CREATE TABLE [definition] (
  [DefNum] bigint,
  [Category] tinyint,
  [ItemOrder] smallint,
  [ItemName] varchar(255),
  [ItemValue] varchar(255),
  [ItemColor] int,
  [IsHidden] tinyint,
  PRIMARY KEY ([DefNum])
);
GO

CREATE TABLE [deletedobject] (
  [DeletedObjectNum] bigint,
  [ObjectNum] bigint,
  [ObjectType] int,
  [DateTStamp] datetime2,
  PRIMARY KEY ([DeletedObjectNum])
);
GO

CREATE TABLE [dictcustom] (
  [DictCustomNum] bigint,
  [WordText] varchar(255),
  PRIMARY KEY ([DictCustomNum])
);
GO

CREATE TABLE [displayreport] (
  [DisplayReportNum] bigint,
  [InternalName] varchar(255),
  [ItemOrder] int,
  [Description] varchar(255),
  [Category] tinyint,
  [IsHidden] tinyint,
  [IsVisibleInSubMenu] tinyint,
  PRIMARY KEY ([DisplayReportNum])
);
GO

CREATE TABLE [documentmisc] (
  [DocMiscNum] bigint,
  [DateCreated] date,
  [FileName] varchar(255),
  [DocMiscType] tinyint,
  [RawBase64] varchar(max),
  PRIMARY KEY ([DocMiscNum])
);
GO

CREATE TABLE [drugmanufacturer] (
  [DrugManufacturerNum] bigint,
  [ManufacturerName] varchar(255),
  [ManufacturerCode] varchar(20),
  PRIMARY KEY ([DrugManufacturerNum])
);
GO

CREATE TABLE [drugunit] (
  [DrugUnitNum] bigint,
  [UnitIdentifier] varchar(20),
  [UnitText] varchar(255),
  PRIMARY KEY ([DrugUnitNum]),
  UNIQUE ([UnitText])
);
GO

CREATE TABLE [eformfield] (
  [EFormFieldNum] bigint,
  [EFormNum] bigint,
  [PatNum] bigint,
  [FieldType] tinyint,
  [DbLink] varchar(255),
  [ValueLabel] varchar(max),
  [ValueString] varchar(max),
  [ItemOrder] int,
  [PickListVis] varchar(max),
  [PickListDb] varchar(max),
  [IsHorizStacking] tinyint,
  [IsTextWrap] tinyint,
  [Width] int,
  [FontScale] int,
  [IsRequired] tinyint,
  [ConditionalParent] varchar(255),
  [ConditionalValue] varchar(max),
  [LabelAlign] tinyint,
  [SpaceBelow] int,
  [ReportableName] varchar(255),
  [IsLocked] tinyint,
  [Border] tinyint,
  [IsWidthPercentage] tinyint,
  [MinWidth] int,
  [WidthLabel] int,
  [SpaceToRight] int,
  [AutoImport] tinyint,
  [PrefillFromGuar] tinyint,
  [ValueLabelEnglish] varchar(max),
  [PickListVisEnglish] varchar(max),
  PRIMARY KEY ([EFormFieldNum])
);
GO

CREATE TABLE [eformfielddef] (
  [EFormFieldDefNum] bigint,
  [EFormDefNum] bigint,
  [FieldType] tinyint,
  [DbLink] varchar(255),
  [ValueLabel] varchar(max),
  [ItemOrder] int,
  [PickListVis] varchar(max),
  [PickListDb] varchar(max),
  [IsHorizStacking] tinyint,
  [IsTextWrap] tinyint,
  [Width] int,
  [FontScale] int,
  [IsRequired] tinyint,
  [ConditionalParent] varchar(255),
  [ConditionalValue] varchar(max),
  [LabelAlign] tinyint,
  [SpaceBelow] int,
  [ReportableName] varchar(255),
  [IsLocked] tinyint,
  [Border] tinyint,
  [IsWidthPercentage] tinyint,
  [MinWidth] int,
  [WidthLabel] int,
  [SpaceToRight] int,
  [AutoImport] tinyint,
  [PrefillFromGuar] tinyint,
  PRIMARY KEY ([EFormFieldDefNum])
);
GO

CREATE TABLE [eformimportrule] (
  [EFormImportRuleNum] bigint,
  [FieldName] varchar(255),
  [Situation] tinyint,
  [Action] tinyint,
  PRIMARY KEY ([EFormImportRuleNum])
);
GO

CREATE TABLE [ehrmeasure] (
  [EhrMeasureNum] bigint,
  [MeasureType] tinyint,
  [Numerator] smallint,
  [Denominator] smallint,
  PRIMARY KEY ([EhrMeasureNum])
);
GO

CREATE TABLE [ehrtrigger] (
  [EhrTriggerNum] bigint,
  [Description] varchar(255),
  [ProblemSnomedList] varchar(max),
  [ProblemIcd9List] varchar(max),
  [ProblemIcd10List] varchar(max),
  [ProblemDefNumList] varchar(max),
  [MedicationNumList] varchar(max),
  [RxCuiList] varchar(max),
  [CvxList] varchar(max),
  [AllergyDefNumList] varchar(max),
  [DemographicsList] varchar(max),
  [LabLoincList] varchar(max),
  [VitalLoincList] varchar(max),
  [Instructions] varchar(max),
  [Bibliography] varchar(max),
  [Cardinality] tinyint,
  PRIMARY KEY ([EhrTriggerNum])
);
GO

CREATE TABLE [electid] (
  [ElectIDNum] bigint,
  [PayorID] varchar(255),
  [CarrierName] varchar(255),
  [IsMedicaid] tinyint,
  [ProviderTypes] varchar(255),
  [Comments] varchar(max),
  [CommBridge] tinyint,
  [Attributes] varchar(255),
  PRIMARY KEY ([ElectIDNum])
);
GO

CREATE TABLE [emailautograph] (
  [EmailAutographNum] bigint,
  [Description] varchar(max),
  [EmailAddress] varchar(255),
  [AutographText] varchar(max),
  PRIMARY KEY ([EmailAutographNum])
);
GO

CREATE TABLE [emailmessageuid] (
  [EmailMessageUidNum] bigint,
  [MsgId] varchar(max),
  [RecipientAddress] varchar(255),
  PRIMARY KEY ([EmailMessageUidNum])
);
GO

CREATE TABLE [emailtemplate] (
  [EmailTemplateNum] bigint,
  [Subject] varchar(max),
  [BodyText] varchar(max),
  [Description] varchar(max),
  [TemplateType] tinyint,
  PRIMARY KEY ([EmailTemplateNum])
);
GO

CREATE TABLE [employee] (
  [EmployeeNum] bigint,
  [LName] varchar(255),
  [FName] varchar(255),
  [MiddleI] varchar(255),
  [IsHidden] tinyint,
  [ClockStatus] varchar(255),
  [PhoneExt] int,
  [PayrollID] varchar(255),
  [WirelessPhone] varchar(255),
  [EmailWork] varchar(255),
  [EmailPersonal] varchar(255),
  [IsFurloughed] tinyint,
  [IsWorkingHome] tinyint,
  [ReportsTo] bigint,
  PRIMARY KEY ([EmployeeNum])
);
GO

CREATE TABLE [employer] (
  [EmployerNum] bigint,
  [EmpName] varchar(255),
  [Address] varchar(255),
  [Address2] varchar(255),
  [City] varchar(255),
  [State] varchar(255),
  [Zip] varchar(255),
  [Phone] varchar(255),
  PRIMARY KEY ([EmployerNum])
);
GO

CREATE TABLE [eserviceshortguid] (
  [EServiceShortGuidNum] bigint,
  [EServiceCode] varchar(255),
  [ShortGuid] varchar(255),
  [ShortURL] varchar(255),
  [FKey] bigint,
  [FKeyType] varchar(255),
  [DateTimeExpiration] datetime,
  [DateTEntry] datetime,
  PRIMARY KEY ([EServiceShortGuidNum])
);
GO

CREATE TABLE [eservicesignal] (
  [EServiceSignalNum] bigint,
  [ServiceCode] int,
  [ReasonCategory] int,
  [ReasonCode] int,
  [Severity] tinyint,
  [Description] varchar(max),
  [SigDateTime] datetime,
  [Tag] varchar(max),
  [IsProcessed] tinyint,
  PRIMARY KEY ([EServiceSignalNum])
);
GO

CREATE TABLE [etransmessagetext] (
  [EtransMessageTextNum] bigint,
  [MessageText] varchar(max),
  PRIMARY KEY ([EtransMessageTextNum])
);
GO

CREATE TABLE [fhirsubscription] (
  [FHIRSubscriptionNum] bigint,
  [Criteria] varchar(255),
  [Reason] varchar(255),
  [SubStatus] tinyint,
  [ErrorNote] varchar(max),
  [ChannelType] tinyint,
  [ChannelEndpoint] varchar(255),
  [ChannelPayLoad] varchar(255),
  [ChannelHeader] varchar(255),
  [DateEnd] datetime,
  [APIKeyHash] varchar(255),
  PRIMARY KEY ([FHIRSubscriptionNum])
);
GO

CREATE TABLE [fielddeflink] (
  [FieldDefLinkNum] bigint,
  [FieldDefNum] bigint,
  [FieldDefType] tinyint,
  [FieldLocation] tinyint,
  PRIMARY KEY ([FieldDefLinkNum])
);
GO

CREATE TABLE [gradingscale] (
  [GradingScaleNum] bigint,
  [Description] varchar(255),
  [ScaleType] tinyint,
  PRIMARY KEY ([GradingScaleNum])
);
GO

CREATE TABLE [hcpcs] (
  [HcpcsNum] bigint,
  [HcpcsCode] varchar(255),
  [DescriptionShort] varchar(255),
  PRIMARY KEY ([HcpcsNum])
);
GO

CREATE TABLE [hl7deffield] (
  [HL7DefFieldNum] bigint,
  [HL7DefSegmentNum] bigint,
  [OrdinalPos] int,
  [TableId] varchar(255),
  [DataType] varchar(255),
  [FieldName] varchar(255),
  [FixedText] varchar(max),
  PRIMARY KEY ([HL7DefFieldNum])
);
GO

CREATE TABLE [icd10] (
  [Icd10Num] bigint,
  [Icd10Code] varchar(255),
  [Description] varchar(255),
  [IsCode] varchar(255),
  PRIMARY KEY ([Icd10Num]),
  UNIQUE ([Icd10Code])
);
GO

CREATE TABLE [icd9] (
  [ICD9Num] bigint,
  [ICD9Code] varchar(255),
  [Description] varchar(255),
  [DateTStamp] datetime2,
  PRIMARY KEY ([ICD9Num]),
  UNIQUE ([ICD9Code])
);
GO

CREATE TABLE [imagingdevice] (
  [ImagingDeviceNum] bigint,
  [Description] varchar(255),
  [ComputerName] varchar(255),
  [DeviceType] tinyint,
  [TwainName] varchar(255),
  [ItemOrder] int,
  [ShowTwainUI] tinyint,
  PRIMARY KEY ([ImagingDeviceNum])
);
GO

CREATE TABLE [insbluebookrule] (
  [InsBlueBookRuleNum] bigint,
  [ItemOrder] smallint,
  [RuleType] tinyint,
  [LimitValue] int,
  [LimitType] tinyint,
  PRIMARY KEY ([InsBlueBookRuleNum])
);
GO

CREATE TABLE [language] (
  [LanguageNum] bigint,
  [EnglishComments] varchar(max),
  [ClassType] varchar(max),
  [English] varchar(max),
  [IsObsolete] tinyint,
  PRIMARY KEY ([LanguageNum])
);
GO

CREATE TABLE [languageforeign] (
  [LanguageForeignNum] bigint,
  [ClassType] varchar(max),
  [English] varchar(max),
  [Culture] varchar(255),
  [Translation] varchar(max),
  [Comments] varchar(max),
  PRIMARY KEY ([LanguageForeignNum])
);
GO

CREATE TABLE [letter] (
  [LetterNum] bigint,
  [Description] varchar(255),
  [BodyText] varchar(max),
  PRIMARY KEY ([LetterNum])
);
GO

CREATE TABLE [limitedbetafeature] (
  [LimitedBetaFeatureNum] bigint,
  [LimitedBetaFeatureTypeNum] bigint,
  [ClinicNum] bigint,
  [IsSignedUp] tinyint
);
GO

CREATE TABLE [loginattempt] (
  [LoginAttemptNum] bigint,
  [UserName] varchar(255),
  [LoginType] tinyint,
  [DateTFail] datetime,
  PRIMARY KEY ([LoginAttemptNum])
);
GO

CREATE TABLE [loinc] (
  [LoincNum] bigint,
  [LoincCode] varchar(30),
  [Component] varchar(255),
  [PropertyObserved] varchar(255),
  [TimeAspct] varchar(255),
  [SystemMeasured] varchar(255),
  [ScaleType] varchar(255),
  [MethodType] varchar(255),
  [StatusOfCode] varchar(255),
  [NameShort] varchar(255),
  [ClassType] varchar(255),
  [UnitsRequired] tinyint,
  [OrderObs] varchar(255),
  [HL7FieldSubfieldID] varchar(255),
  [ExternalCopyrightNotice] varchar(max),
  [NameLongCommon] varchar(255),
  [UnitsUCUM] varchar(255),
  [RankCommonTests] int,
  [RankCommonOrders] int,
  PRIMARY KEY ([LoincNum]),
  UNIQUE ([LoincCode])
);
GO

CREATE TABLE [medication] (
  [MedicationNum] bigint,
  [MedName] varchar(255),
  [GenericNum] bigint,
  [Notes] varchar(max),
  [DateTStamp] datetime2,
  [RxCui] bigint,
  [IsHidden] tinyint,
  PRIMARY KEY ([MedicationNum])
);
GO

CREATE TABLE [medlabfacility] (
  [MedLabFacilityNum] bigint,
  [FacilityName] varchar(255),
  [Address] varchar(255),
  [City] varchar(255),
  [State] varchar(255),
  [Zip] varchar(255),
  [Phone] varchar(255),
  [DirectorTitle] varchar(255),
  [DirectorLName] varchar(255),
  [DirectorFName] varchar(255),
  PRIMARY KEY ([MedLabFacilityNum])
);
GO

CREATE TABLE [mobiledatabyte] (
  [MobileDataByteNum] bigint,
  [RawBase64Data] varchar(max),
  [RawBase64Code] varchar(max),
  [RawBase64Tag] varchar(max),
  [PatNum] bigint,
  [ActionType] tinyint,
  [DateTimeEntry] datetime,
  [DateTimeExpires] datetime,
  PRIMARY KEY ([MobileDataByteNum])
);
GO

CREATE TABLE [mobilenotification] (
  [MobileNotificationNum] bigint,
  [NotificationType] tinyint,
  [DeviceId] varchar(255),
  [PrimaryKeys] varchar(max),
  [Tags] varchar(max),
  [DateTimeEntry] datetime,
  [DateTimeExpires] datetime,
  [AppTarget] tinyint,
  PRIMARY KEY ([MobileNotificationNum])
);
GO

CREATE TABLE [oidinternal] (
  [OIDInternalNum] bigint,
  [IDType] varchar(255),
  [IDRoot] varchar(255),
  PRIMARY KEY ([OIDInternalNum])
);
GO

CREATE TABLE [orionproc] (
  [OrionProcNum] bigint,
  [ProcNum] bigint,
  [DPC] tinyint,
  [DateScheduleBy] date,
  [DateStopClock] date,
  [Status2] int,
  [IsOnCall] tinyint,
  [IsEffectiveComm] tinyint,
  [IsRepair] tinyint,
  [DPCpost] tinyint
);
GO

CREATE TABLE [orthocharttab] (
  [OrthoChartTabNum] bigint,
  [TabName] varchar(255),
  [ItemOrder] int,
  [IsHidden] tinyint,
  PRIMARY KEY ([OrthoChartTabNum])
);
GO

CREATE TABLE [orthohardwarespec] (
  [OrthoHardwareSpecNum] bigint,
  [OrthoHardwareType] tinyint,
  [Description] varchar(255),
  [ItemColor] int,
  [IsHidden] tinyint,
  [ItemOrder] int,
  PRIMARY KEY ([OrthoHardwareSpecNum])
);
GO

CREATE TABLE [orthoschedule] (
  [OrthoScheduleNum] bigint,
  [BandingDateOverride] date,
  [DebondDateOverride] date,
  [BandingAmount] float,
  [VisitAmount] float,
  [DebondAmount] float,
  [IsActive] tinyint,
  [SecDateTEdit] datetime2,
  PRIMARY KEY ([OrthoScheduleNum])
);
GO

CREATE TABLE [patfielddef] (
  [PatFieldDefNum] bigint,
  [FieldName] varchar(255),
  [FieldType] tinyint,
  [PickList] varchar(max),
  [ItemOrder] int,
  [IsHidden] tinyint,
  PRIMARY KEY ([PatFieldDefNum]),
  UNIQUE ([FieldName])
);
GO

CREATE TABLE [payperiod] (
  [PayPeriodNum] bigint,
  [DateStart] date,
  [DateStop] date,
  [DatePaycheck] date,
  PRIMARY KEY ([PayPeriodNum])
);
GO

CREATE TABLE [paysuitepaymentdetail] (
  [PaySuitePaymentDetailNum] bigint,
  [DetailsJson] varchar(max),
  PRIMARY KEY ([PaySuitePaymentDetailNum])
);
GO

CREATE TABLE [pharmacy] (
  [PharmacyNum] bigint,
  [PharmID] varchar(255),
  [StoreName] varchar(255),
  [Phone] varchar(255),
  [Fax] varchar(255),
  [Address] varchar(255),
  [Address2] varchar(255),
  [City] varchar(255),
  [State] varchar(255),
  [Zip] varchar(255),
  [Note] varchar(max),
  [DateTStamp] datetime2,
  PRIMARY KEY ([PharmacyNum])
);
GO

CREATE TABLE [preference] (
  [PrefName] varchar(255),
  [ValueString] varchar(max),
  [PrefNum] bigint,
  [Comments] varchar(max),
  PRIMARY KEY ([PrefNum])
);
GO

CREATE TABLE [procapptcolor] (
  [ProcApptColorNum] bigint,
  [CodeRange] varchar(255),
  [ColorText] int,
  [ShowPreviousDate] tinyint,
  PRIMARY KEY ([ProcApptColorNum])
);
GO

CREATE TABLE [program] (
  [ProgramNum] bigint,
  [ProgName] varchar(100),
  [ProgDesc] varchar(100),
  [Enabled] tinyint,
  [Path] varchar(max),
  [CommandLine] varchar(max),
  [Note] varchar(max),
  [PluginDllName] varchar(255),
  [ButtonImage] varchar(max),
  [FileTemplate] varchar(max),
  [FilePath] varchar(255),
  [IsDisabledByHq] tinyint,
  [CustErr] varchar(255),
  PRIMARY KEY ([ProgramNum])
);
GO

CREATE TABLE [queryfilter] (
  [QueryFilterNum] bigint,
  [GroupName] varchar(255),
  [FilterText] varchar(255),
  PRIMARY KEY ([QueryFilterNum])
);
GO

CREATE TABLE [questiondef] (
  [QuestionDefNum] bigint,
  [Description] varchar(max),
  [ItemOrder] smallint,
  [QuestType] tinyint,
  PRIMARY KEY ([QuestionDefNum])
);
GO

CREATE TABLE [quickpastecat] (
  [QuickPasteCatNum] bigint,
  [Description] varchar(255),
  [ItemOrder] smallint,
  [DefaultForTypes] varchar(max),
  PRIMARY KEY ([QuickPasteCatNum])
);
GO

CREATE TABLE [recalltype] (
  [RecallTypeNum] bigint,
  [Description] varchar(255),
  [DefaultInterval] int,
  [TimePattern] varchar(255),
  [Procedures] varchar(255),
  [AppendToSpecial] tinyint,
  PRIMARY KEY ([RecallTypeNum])
);
GO

CREATE TABLE [reminderrule] (
  [ReminderRuleNum] bigint,
  [ReminderCriterion] tinyint,
  [CriterionFK] bigint,
  [CriterionValue] varchar(255),
  [Message] varchar(255),
  PRIMARY KEY ([ReminderRuleNum])
);
GO

CREATE TABLE [replicationserver] (
  [ReplicationServerNum] bigint,
  [Descript] varchar(max),
  [ServerId] int,
  [RangeStart] bigint,
  [RangeEnd] bigint,
  [AtoZpath] varchar(255),
  [UpdateBlocked] tinyint,
  [SlaveMonitor] varchar(255),
  PRIMARY KEY ([ReplicationServerNum])
);
GO

CREATE TABLE [requiredfield] (
  [RequiredFieldNum] bigint,
  [FieldType] tinyint,
  [FieldName] varchar(50),
  PRIMARY KEY ([RequiredFieldNum])
);
GO

CREATE TABLE [rxdef] (
  [RxDefNum] bigint,
  [Drug] varchar(255),
  [Sig] varchar(255),
  [Disp] varchar(255),
  [Refills] varchar(30),
  [Notes] varchar(255),
  [IsControlled] tinyint,
  [RxCui] bigint,
  [IsProcRequired] tinyint,
  [PatientInstruction] varchar(max),
  PRIMARY KEY ([RxDefNum])
);
GO

CREATE TABLE [rxnorm] (
  [RxNormNum] bigint,
  [RxCui] varchar(255),
  [MmslCode] varchar(255),
  [Description] varchar(max),
  PRIMARY KEY ([RxNormNum])
);
GO

CREATE TABLE [scheduledprocess] (
  [ScheduledProcessNum] bigint,
  [ScheduledAction] varchar(50),
  [TimeToRun] datetime,
  [FrequencyToRun] varchar(50),
  [LastRanDateTime] datetime
);
GO

CREATE TABLE [schoolclass] (
  [SchoolClassNum] bigint,
  [GradYear] int,
  [Descript] varchar(255),
  PRIMARY KEY ([SchoolClassNum])
);
GO

CREATE TABLE [sequencecounter] (
  [CounterNum] bigint,
  [CounterName] varchar(255),
  [CounterVal] bigint,
  PRIMARY KEY ([CounterNum])
);
GO

CREATE TABLE [sessiontoken] (
  [SessionTokenNum] bigint,
  [SessionTokenHash] varchar(255),
  [Expiration] datetime,
  [TokenType] tinyint,
  [FKey] bigint,
  PRIMARY KEY ([SessionTokenNum])
);
GO

CREATE TABLE [sigelementdef] (
  [SigElementDefNum] bigint,
  [LightRow] tinyint,
  [LightColor] int,
  [SigElementType] tinyint,
  [SigText] varchar(255),
  [Sound] varchar(max),
  [ItemOrder] smallint,
  PRIMARY KEY ([SigElementDefNum])
);
GO

CREATE TABLE [signalod] (
  [SignalNum] bigint,
  [DateViewing] date,
  [SigDateTime] datetime,
  [FKey] bigint,
  [FKeyType] varchar(255),
  [IType] tinyint,
  [RemoteRole] tinyint,
  [MsgValue] varchar(max),
  PRIMARY KEY ([SignalNum])
);
GO

CREATE TABLE [smsblockphone] (
  [SmsBlockPhoneNum] bigint,
  [BlockWirelessNumber] varchar(255),
  PRIMARY KEY ([SmsBlockPhoneNum])
);
GO

CREATE TABLE [snomed] (
  [SnomedNum] bigint,
  [SnomedCode] varchar(255),
  [Description] varchar(255),
  PRIMARY KEY ([SnomedNum]),
  UNIQUE ([SnomedCode])
);
GO

CREATE TABLE [sop] (
  [SopNum] bigint,
  [SopCode] varchar(255),
  [Description] varchar(255),
  PRIMARY KEY ([SopNum]),
  UNIQUE ([SopCode])
);
GO

CREATE TABLE [stateabbr] (
  [StateAbbrNum] bigint,
  [Description] varchar(50),
  [Abbr] varchar(50),
  [MedicaidIDLength] int,
  PRIMARY KEY ([StateAbbrNum])
);
GO

CREATE TABLE [supplier] (
  [SupplierNum] bigint,
  [Name] varchar(255),
  [Phone] varchar(255),
  [CustomerId] varchar(255),
  [Website] varchar(max),
  [UserName] varchar(255),
  [Password] varchar(255),
  [Note] varchar(max),
  PRIMARY KEY ([SupplierNum])
);
GO

CREATE TABLE [supplyneeded] (
  [SupplyNeededNum] bigint,
  [Description] varchar(max),
  [DateAdded] date,
  PRIMARY KEY ([SupplyNeededNum])
);
GO

CREATE TABLE [tasklist] (
  [TaskListNum] bigint,
  [Descript] varchar(255),
  [Parent] bigint,
  [DateTL] date,
  [IsRepeating] tinyint,
  [DateType] tinyint,
  [FromNum] bigint,
  [ObjectType] tinyint,
  [DateTimeEntry] datetime,
  [GlobalTaskFilterType] tinyint,
  [TaskListStatus] tinyint,
  PRIMARY KEY ([TaskListNum])
);
GO

CREATE TABLE [transactioninvoice] (
  [TransactionInvoiceNum] bigint,
  [FileName] varchar(255),
  [InvoiceData] varchar(max),
  [FilePath] varchar(255),
  PRIMARY KEY ([TransactionInvoiceNum])
);
GO

CREATE TABLE [ucum] (
  [UcumNum] bigint,
  [UcumCode] varchar(255),
  [Description] varchar(255),
  [IsInUse] tinyint,
  PRIMARY KEY ([UcumNum])
);
GO

CREATE TABLE [updatehistory] (
  [UpdateHistoryNum] bigint,
  [DateTimeUpdated] datetime,
  [ProgramVersion] varchar(255),
  [Signature] varchar(max),
  PRIMARY KEY ([UpdateHistoryNum])
);
GO

CREATE TABLE [usergroup] (
  [UserGroupNum] bigint,
  [Description] varchar(255),
  [UserGroupNumCEMT] bigint,
  PRIMARY KEY ([UserGroupNum])
);
GO

CREATE TABLE [userquery] (
  [QueryNum] bigint,
  [Description] varchar(255),
  [FileName] varchar(255),
  [QueryText] varchar(max),
  [IsReleased] tinyint,
  [IsPromptSetup] tinyint,
  [DefaultFormatRaw] tinyint,
  PRIMARY KEY ([QueryNum])
);
GO

CREATE TABLE [userweb] (
  [UserWebNum] bigint,
  [FKey] bigint,
  [FKeyType] tinyint,
  [UserName] varchar(255),
  [Password] varchar(255),
  [PasswordResetCode] varchar(255),
  [RequireUserNameChange] tinyint,
  [DateTimeLastLogin] datetime,
  [RequirePasswordChange] tinyint,
  PRIMARY KEY ([UserWebNum])
);
GO

CREATE TABLE [utm] (
  [UtmNum] bigint,
  [CampaignName] varchar(500),
  [MediumInfo] varchar(500),
  [SourceInfo] varchar(500),
  PRIMARY KEY ([UtmNum])
);
GO

CREATE TABLE [wikilistheaderwidth] (
  [WikiListHeaderWidthNum] bigint,
  [ListName] varchar(255),
  [ColName] varchar(255),
  [ColWidth] int,
  [PickList] varchar(max),
  [IsHidden] tinyint,
  PRIMARY KEY ([WikiListHeaderWidthNum])
);
GO

CREATE TABLE [zipcode] (
  [ZipCodeNum] bigint,
  [ZipCodeDigits] varchar(20),
  [City] varchar(100),
  [State] varchar(20),
  [IsFrequent] tinyint,
  PRIMARY KEY ([ZipCodeNum])
);
GO

CREATE TABLE [reconcile] (
  [ReconcileNum] bigint,
  [AccountNum] bigint,
  [StartingBal] float,
  [EndingBal] float,
  [DateReconcile] date,
  [IsLocked] tinyint,
  PRIMARY KEY ([ReconcileNum])
);
GO

CREATE TABLE [alertcategorylink] (
  [AlertCategoryLinkNum] bigint,
  [AlertCategoryNum] bigint,
  [AlertType] tinyint,
  PRIMARY KEY ([AlertCategoryLinkNum])
);
GO

CREATE TABLE [displayfield] (
  [DisplayFieldNum] bigint,
  [InternalName] varchar(255),
  [ItemOrder] int,
  [Description] varchar(255),
  [ColumnWidth] int,
  [Category] int,
  [ChartViewNum] bigint,
  [PickList] varchar(max),
  [DescriptionOverride] varchar(255),
  PRIMARY KEY ([DisplayFieldNum])
);
GO

CREATE TABLE [claimformitem] (
  [ClaimFormItemNum] bigint,
  [ClaimFormNum] bigint,
  [ImageFileName] varchar(255),
  [FieldName] varchar(255),
  [FormatString] varchar(255),
  [XPos] float,
  [YPos] float,
  [Width] float,
  [Height] float,
  PRIMARY KEY ([ClaimFormItemNum])
);
GO

CREATE TABLE [printer] (
  [PrinterNum] bigint,
  [ComputerNum] bigint,
  [PrintSit] tinyint,
  [PrinterName] varchar(255),
  [DisplayPrompt] tinyint,
  [FileExtension] varchar(255),
  [IsVirtualPrinter] tinyint,
  PRIMARY KEY ([PrinterNum])
);
GO

CREATE TABLE [conngroupattach] (
  [ConnGroupAttachNum] bigint,
  [ConnectionGroupNum] bigint,
  [CentralConnectionNum] bigint
);
GO

CREATE TABLE [covspan] (
  [CovSpanNum] bigint,
  [CovCatNum] bigint,
  [FromCode] varchar(15),
  [ToCode] varchar(15),
  PRIMARY KEY ([CovSpanNum])
);
GO

CREATE TABLE [procbutton] (
  [ProcButtonNum] bigint,
  [Description] varchar(255),
  [ItemOrder] smallint,
  [Category] bigint,
  [ButtonImage] varchar(max),
  [IsMultiVisit] tinyint,
  PRIMARY KEY ([ProcButtonNum])
);
GO

CREATE TABLE [hl7def] (
  [HL7DefNum] bigint,
  [Description] varchar(255),
  [ModeTx] tinyint,
  [IncomingFolder] varchar(255),
  [OutgoingFolder] varchar(255),
  [IncomingPort] varchar(255),
  [OutgoingIpPort] varchar(255),
  [FieldSeparator] varchar(5),
  [ComponentSeparator] varchar(5),
  [SubcomponentSeparator] varchar(5),
  [RepetitionSeparator] varchar(5),
  [EscapeCharacter] varchar(5),
  [IsInternal] tinyint,
  [InternalType] varchar(255),
  [InternalTypeVersion] varchar(50),
  [IsEnabled] tinyint,
  [Note] varchar(max),
  [HL7Server] varchar(255),
  [HL7ServiceName] varchar(255),
  [ShowDemographics] tinyint,
  [ShowAppts] tinyint,
  [ShowAccount] tinyint,
  [IsQuadAsToothNum] tinyint,
  [LabResultImageCat] bigint,
  [SftpUsername] varchar(255),
  [SftpPassword] varchar(255),
  [SftpInSocket] varchar(255),
  [HasLongDCodes] tinyint,
  [IsProcApptEnforced] tinyint,
  PRIMARY KEY ([HL7DefNum])
);
GO

CREATE TABLE [eform] (
  [EFormNum] bigint,
  [FormType] tinyint,
  [PatNum] bigint,
  [DateTimeShown] datetime,
  [Description] varchar(255),
  [DateTEdited] datetime,
  [MaxWidth] int,
  [EFormDefNum] bigint,
  [Status] tinyint,
  [RevID] int,
  [ShowLabelsBold] tinyint,
  [SpaceBelowEachField] int,
  [SpaceToRightEachField] int,
  [SaveImageCategory] bigint,
  PRIMARY KEY ([EFormNum])
);
GO

CREATE TABLE [lettermerge] (
  [LetterMergeNum] bigint,
  [Description] varchar(255),
  [TemplateName] varchar(255),
  [DataFileName] varchar(255),
  [Category] bigint,
  [ImageFolder] bigint,
  PRIMARY KEY ([LetterMergeNum])
);
GO

CREATE TABLE [accountingautopay] (
  [AccountingAutoPayNum] bigint,
  [PayType] bigint,
  [PickList] bigint,
  PRIMARY KEY ([AccountingAutoPayNum])
);
GO

CREATE TABLE [eformdef] (
  [EFormDefNum] bigint,
  [FormType] tinyint,
  [Description] varchar(255),
  [DateTCreated] datetime,
  [IsInternalHidden] tinyint,
  [MaxWidth] int,
  [RevID] int,
  [ShowLabelsBold] tinyint,
  [SpaceBelowEachField] int,
  [SpaceToRightEachField] int,
  [SaveImageCategory] bigint,
  PRIMARY KEY ([EFormDefNum])
);
GO

CREATE TABLE [insfilingcode] (
  [InsFilingCodeNum] bigint,
  [Descript] varchar(255),
  [EclaimCode] varchar(100),
  [ItemOrder] int,
  [GroupType] bigint,
  [ExcludeOtherCoverageOnPriClaims] tinyint,
  PRIMARY KEY ([InsFilingCodeNum])
);
GO

CREATE TABLE [deflink] (
  [DefLinkNum] bigint,
  [DefNum] bigint,
  [FKey] bigint,
  [LinkType] tinyint,
  PRIMARY KEY ([DefLinkNum])
);
GO

CREATE TABLE [deposit] (
  [DepositNum] bigint,
  [DateDeposit] date,
  [BankAccountInfo] varchar(max),
  [Amount] float,
  [Memo] varchar(255),
  [Batch] varchar(25),
  [DepositAccountNum] bigint,
  [IsSentToQuickBooksOnline] tinyint,
  PRIMARY KEY ([DepositNum])
);
GO

CREATE TABLE [mountdef] (
  [MountDefNum] bigint,
  [Description] varchar(255),
  [ItemOrder] int,
  [Width] int,
  [Height] int,
  [ColorBack] int,
  [ColorFore] int,
  [ColorTextBack] int,
  [ScaleValue] varchar(255),
  [DefaultCat] bigint,
  [FlipOnAcquire] tinyint,
  [AdjModeAfterSeries] tinyint,
  PRIMARY KEY ([MountDefNum])
);
GO

CREATE TABLE [sheetdef] (
  [SheetDefNum] bigint,
  [Description] varchar(255),
  [SheetType] int,
  [FontSize] float,
  [FontName] varchar(255),
  [Width] int,
  [Height] int,
  [IsLandscape] tinyint,
  [PageCount] int,
  [IsMultiPage] tinyint,
  [BypassGlobalLock] tinyint,
  [HasMobileLayout] tinyint,
  [DateTCreated] datetime,
  [RevID] int,
  [AutoCheckSaveImage] tinyint,
  [AutoCheckSaveImageDocCategory] bigint,
  PRIMARY KEY ([SheetDefNum])
);
GO

CREATE TABLE [contact] (
  [ContactNum] bigint,
  [LName] varchar(255),
  [FName] varchar(255),
  [WkPhone] varchar(255),
  [Fax] varchar(255),
  [Category] bigint,
  [Notes] varchar(max),
  PRIMARY KEY ([ContactNum])
);
GO

CREATE TABLE [cert] (
  [CertNum] bigint,
  [Description] varchar(255),
  [WikiPageLink] varchar(255),
  [ItemOrder] int,
  [IsHidden] tinyint,
  [CertCategoryNum] bigint,
  PRIMARY KEY ([CertNum])
);
GO

CREATE TABLE [autonote] (
  [AutoNoteNum] bigint,
  [AutoNoteName] varchar(50),
  [MainText] varchar(max),
  [Category] bigint,
  PRIMARY KEY ([AutoNoteNum])
);
GO

CREATE TABLE [vaccinedef] (
  [VaccineDefNum] bigint,
  [CVXCode] varchar(255),
  [VaccineName] varchar(255),
  [DrugManufacturerNum] bigint,
  PRIMARY KEY ([VaccineDefNum])
);
GO

CREATE TABLE [languagepat] (
  [LanguagePatNum] bigint,
  [PrefName] varchar(255),
  [Language] varchar(255),
  [Translation] varchar(max),
  [EFormFieldDefNum] bigint,
  PRIMARY KEY ([LanguagePatNum])
);
GO

CREATE TABLE [timecardrule] (
  [TimeCardRuleNum] bigint,
  [EmployeeNum] bigint,
  [OverHoursPerDay] time,
  [AfterTimeOfDay] time,
  [BeforeTimeOfDay] time,
  [IsOvertimeExempt] tinyint,
  [MinClockInTime] time,
  [HasWeekendRate3] tinyint,
  PRIMARY KEY ([TimeCardRuleNum])
);
GO

CREATE TABLE [fhircontactpoint] (
  [FHIRContactPointNum] bigint,
  [FHIRSubscriptionNum] bigint,
  [ContactSystem] tinyint,
  [ContactValue] varchar(255),
  [ContactUse] tinyint,
  [ItemOrder] int,
  [DateStart] date,
  [DateEnd] date,
  PRIMARY KEY ([FHIRContactPointNum])
);
GO

CREATE TABLE [schoolcoursedef] (
  [SchoolCourseDefNum] bigint,
  [CourseID] varchar(255),
  [Descript] varchar(255),
  [GradingScaleNum] bigint,
  PRIMARY KEY ([SchoolCourseDefNum])
);
GO

CREATE TABLE [gradingscaleitem] (
  [GradingScaleItemNum] bigint,
  [GradingScaleNum] bigint,
  [GradeShowing] varchar(255),
  [GradeNumber] float,
  [Description] varchar(255),
  PRIMARY KEY ([GradingScaleItemNum])
);
GO

CREATE TABLE [allergydef] (
  [AllergyDefNum] bigint,
  [Description] varchar(255),
  [IsHidden] tinyint,
  [DateTStamp] datetime2,
  [SnomedType] tinyint,
  [MedicationNum] bigint,
  [UniiCode] varchar(255),
  PRIMARY KEY ([AllergyDefNum])
);
GO

CREATE TABLE [orthorx] (
  [OrthoRxNum] bigint,
  [OrthoHardwareSpecNum] bigint,
  [Description] varchar(255),
  [ToothRange] varchar(255),
  [ItemOrder] int,
  PRIMARY KEY ([OrthoRxNum])
);
GO

CREATE TABLE [patfieldpickitem] (
  [PatFieldPickItemNum] bigint,
  [PatFieldDefNum] bigint,
  [Name] varchar(255),
  [Abbreviation] varchar(255),
  [IsHidden] tinyint,
  [ItemOrder] int,
  PRIMARY KEY ([PatFieldPickItemNum])
);
GO

CREATE TABLE [toolbutitem] (
  [ToolButItemNum] bigint,
  [ProgramNum] bigint,
  [ToolBar] smallint,
  [ButtonText] varchar(255),
  PRIMARY KEY ([ToolButItemNum])
);
GO

CREATE TABLE [quickpastenote] (
  [QuickPasteNoteNum] bigint,
  [QuickPasteCatNum] bigint,
  [ItemOrder] smallint,
  [Note] varchar(max),
  [Abbreviation] varchar(255),
  PRIMARY KEY ([QuickPasteNoteNum])
);
GO

CREATE TABLE [requiredfieldcondition] (
  [RequiredFieldConditionNum] bigint,
  [RequiredFieldNum] bigint,
  [ConditionType] varchar(50),
  [Operator] tinyint,
  [ConditionValue] varchar(255),
  [ConditionRelationship] tinyint,
  PRIMARY KEY ([RequiredFieldConditionNum])
);
GO

CREATE TABLE [schoolcourse] (
  [SchoolCourseNum] bigint,
  [CourseID] varchar(255),
  [Descript] varchar(255),
  [DateStart] date,
  [DateEnd] date,
  [SchoolClassNum] bigint,
  [GradingScaleNum] bigint,
  PRIMARY KEY ([SchoolCourseNum])
);
GO

CREATE TABLE [sigmessage] (
  [SigMessageNum] bigint,
  [ButtonText] varchar(255),
  [ButtonIndex] int,
  [SynchIcon] tinyint,
  [FromUser] varchar(255),
  [ToUser] varchar(255),
  [MessageDateTime] datetime,
  [AckDateTime] datetime,
  [SigText] varchar(255),
  [SigElementDefNumUser] bigint,
  [SigElementDefNumExtra] bigint,
  [SigElementDefNumMsg] bigint,
  PRIMARY KEY ([SigMessageNum])
);
GO

CREATE TABLE [sigbutdef] (
  [SigButDefNum] bigint,
  [ButtonText] varchar(255),
  [ButtonIndex] smallint,
  [SynchIcon] tinyint,
  [ComputerName] varchar(255),
  [SigElementDefNumUser] bigint,
  [SigElementDefNumExtra] bigint,
  [SigElementDefNumMsg] bigint,
  PRIMARY KEY ([SigButDefNum])
);
GO

CREATE TABLE [diseasedef] (
  [DiseaseDefNum] bigint,
  [DiseaseName] varchar(255),
  [ItemOrder] smallint,
  [IsHidden] tinyint,
  [DateTStamp] datetime2,
  [ICD9Code] varchar(255),
  [SnomedCode] varchar(255),
  [Icd10Code] varchar(255),
  PRIMARY KEY ([DiseaseDefNum])
);
GO

CREATE TABLE [supply] (
  [SupplyNum] bigint,
  [SupplierNum] bigint,
  [CatalogNumber] varchar(255),
  [Descript] varchar(255),
  [Category] bigint,
  [ItemOrder] int,
  [LevelDesired] float,
  [IsHidden] tinyint,
  [Price] float,
  [BarCodeOrID] varchar(255),
  [DispDefaultQuant] float,
  [DispUnitsCount] int,
  [DispUnitDesc] varchar(255),
  [LevelOnHand] float,
  [OrderQty] int,
  PRIMARY KEY ([SupplyNum])
);
GO

CREATE TABLE [grouppermission] (
  [GroupPermNum] bigint,
  [NewerDate] date,
  [NewerDays] int,
  [UserGroupNum] bigint,
  [PermType] smallint,
  [FKey] bigint,
  PRIMARY KEY ([GroupPermNum])
);
GO

CREATE TABLE [orthocharttablink] (
  [OrthoChartTabLinkNum] bigint,
  [ItemOrder] int,
  [OrthoChartTabNum] bigint,
  [DisplayFieldNum] bigint,
  [ColumnWidthOverride] int,
  PRIMARY KEY ([OrthoChartTabLinkNum])
);
GO

CREATE TABLE [hl7defmessage] (
  [HL7DefMessageNum] bigint,
  [HL7DefNum] bigint,
  [MessageType] varchar(255),
  [EventType] varchar(255),
  [InOrOut] tinyint,
  [ItemOrder] int,
  [Note] varchar(max),
  [MessageStructure] varchar(255),
  PRIMARY KEY ([HL7DefMessageNum])
);
GO

CREATE TABLE [lettermergefield] (
  [FieldNum] bigint,
  [LetterMergeNum] bigint,
  [FieldName] varchar(255),
  PRIMARY KEY ([FieldNum])
);
GO

CREATE TABLE [insfilingcodesubtype] (
  [InsFilingCodeSubtypeNum] bigint,
  [InsFilingCodeNum] bigint,
  [Descript] varchar(255),
  PRIMARY KEY ([InsFilingCodeSubtypeNum])
);
GO

CREATE TABLE [mountitemdef] (
  [MountItemDefNum] bigint,
  [MountDefNum] bigint,
  [Xpos] int,
  [Ypos] int,
  [Width] int,
  [Height] int,
  [ItemOrder] int,
  [RotateOnAcquire] int,
  [ToothNumbers] varchar(255),
  [TextShowing] varchar(max),
  [FontSize] float,
  PRIMARY KEY ([MountItemDefNum])
);
GO

CREATE TABLE [laboratory] (
  [LaboratoryNum] bigint,
  [Description] varchar(255),
  [Phone] varchar(255),
  [Notes] varchar(max),
  [Slip] bigint,
  [Address] varchar(255),
  [City] varchar(255),
  [State] varchar(255),
  [Zip] varchar(255),
  [Email] varchar(255),
  [WirelessPhone] varchar(255),
  [IsHidden] tinyint,
  PRIMARY KEY ([LaboratoryNum])
);
GO

CREATE TABLE [sheetfielddef] (
  [SheetFieldDefNum] bigint,
  [SheetDefNum] bigint,
  [FieldType] int,
  [FieldName] varchar(255),
  [FieldValue] varchar(max),
  [FontSize] float,
  [FontName] varchar(255),
  [FontIsBold] tinyint,
  [XPos] int,
  [YPos] int,
  [Width] int,
  [Height] int,
  [GrowthBehavior] int,
  [RadioButtonValue] varchar(255),
  [RadioButtonGroup] varchar(255),
  [IsRequired] tinyint,
  [TabOrder] int,
  [ReportableName] varchar(255),
  [TextAlign] tinyint,
  [IsPaymentOption] tinyint,
  [ItemColor] int,
  [IsLocked] tinyint,
  [TabOrderMobile] int,
  [UiLabelMobile] varchar(max),
  [UiLabelMobileRadioButton] varchar(max),
  [LayoutMode] tinyint,
  [Language] varchar(255),
  [CanElectronicallySign] tinyint,
  [IsSigProvRestricted] tinyint,
  PRIMARY KEY ([SheetFieldDefNum])
);
GO

CREATE TABLE [automation] (
  [AutomationNum] bigint,
  [Description] varchar(max),
  [Autotrigger] tinyint,
  [ProcCodes] varchar(max),
  [AutoAction] tinyint,
  [SheetDefNum] bigint,
  [CommType] bigint,
  [MessageContent] varchar(max),
  [AptStatus] tinyint,
  [AppointmentTypeNum] bigint,
  [PatStatus] tinyint,
  PRIMARY KEY ([AutomationNum])
);
GO

CREATE TABLE [evaluationdef] (
  [EvaluationDefNum] bigint,
  [SchoolCourseNum] bigint,
  [EvalTitle] varchar(255),
  [GradingScaleNum] bigint,
  [SchoolCourseDefNum] bigint,
  PRIMARY KEY ([EvaluationDefNum])
);
GO

CREATE TABLE [schoolcoursesched] (
  [SchoolCourseSchedNum] bigint,
  [SchoolCourseDefNum] bigint,
  [SchoolCourseNum] bigint,
  [TimeStart] time,
  [TimeEnd] time,
  [DayOfTheWeek] tinyint,
  [DateOverride] date,
  [IsOverride] tinyint,
  [IsCanceled] tinyint,
  PRIMARY KEY ([SchoolCourseSchedNum])
);
GO

CREATE TABLE [reqneeded] (
  [ReqNeededNum] bigint,
  [Descript] varchar(255),
  [SchoolCourseNum] bigint,
  [SchoolClassNum] bigint,
  [SchoolCourseDefNum] bigint,
  PRIMARY KEY ([ReqNeededNum])
);
GO

CREATE TABLE [rxalert] (
  [RxAlertNum] bigint,
  [RxDefNum] bigint,
  [DiseaseDefNum] bigint,
  [AllergyDefNum] bigint,
  [MedicationNum] bigint,
  [NotificationMsg] varchar(255),
  [IsHighSignificance] tinyint,
  PRIMARY KEY ([RxAlertNum])
);
GO

CREATE TABLE [hl7defsegment] (
  [HL7DefSegmentNum] bigint,
  [HL7DefMessageNum] bigint,
  [ItemOrder] int,
  [CanRepeat] tinyint,
  [IsOptional] tinyint,
  [SegmentName] varchar(255),
  [Note] varchar(max),
  PRIMARY KEY ([HL7DefSegmentNum])
);
GO

CREATE TABLE [labturnaround] (
  [LabTurnaroundNum] bigint,
  [LaboratoryNum] bigint,
  [Description] varchar(255),
  [DaysPublished] smallint,
  [DaysActual] smallint,
  PRIMARY KEY ([LabTurnaroundNum])
);
GO

CREATE TABLE [automationcondition] (
  [AutomationConditionNum] bigint,
  [AutomationNum] bigint,
  [CompareField] tinyint,
  [Comparison] tinyint,
  [CompareString] varchar(255),
  PRIMARY KEY ([AutomationConditionNum])
);
GO

CREATE TABLE [evaluationcriteriondef] (
  [EvaluationCriterionDefNum] bigint,
  [EvaluationDefNum] bigint,
  [CriterionDescript] varchar(255),
  [IsCategoryName] tinyint,
  [GradingScaleNum] bigint,
  [ItemOrder] int,
  [MaxPointsPoss] float,
  PRIMARY KEY ([EvaluationCriterionDefNum])
);
GO

CREATE TABLE [activeinstance] (
  [ActiveInstanceNum] bigint,
  [ComputerNum] bigint,
  [UserNum] bigint,
  [ProcessId] bigint,
  [DateTimeLastActive] datetime,
  [DateTRecorded] datetime,
  [ConnectionType] tinyint,
  PRIMARY KEY ([ActiveInstanceNum])
);
GO

CREATE TABLE [adjustment] (
  [AdjNum] bigint,
  [AdjDate] date,
  [AdjAmt] float,
  [PatNum] bigint,
  [AdjType] bigint,
  [ProvNum] bigint,
  [AdjNote] varchar(max),
  [ProcDate] date,
  [ProcNum] bigint,
  [DateEntry] date,
  [ClinicNum] bigint,
  [StatementNum] bigint,
  [SecUserNumEntry] bigint,
  [SecDateTEdit] datetime2,
  [TaxTransID] bigint,
  PRIMARY KEY ([AdjNum])
);
GO

CREATE TABLE [alertitem] (
  [AlertItemNum] bigint,
  [ClinicNum] bigint,
  [Description] varchar(2000),
  [Type] tinyint,
  [Severity] tinyint,
  [Actions] tinyint,
  [FormToOpen] tinyint,
  [FKey] bigint,
  [ItemValue] varchar(4000),
  [UserNum] bigint,
  [SecDateTEntry] datetime,
  PRIMARY KEY ([AlertItemNum])
);
GO

CREATE TABLE [alertread] (
  [AlertReadNum] bigint,
  [AlertItemNum] bigint,
  [UserNum] bigint,
  PRIMARY KEY ([AlertReadNum])
);
GO

CREATE TABLE [alertsub] (
  [AlertSubNum] bigint,
  [UserNum] bigint,
  [ClinicNum] bigint,
  [Type] tinyint,
  [AlertCategoryNum] bigint,
  PRIMARY KEY ([AlertSubNum])
);
GO

CREATE TABLE [allergy] (
  [AllergyNum] bigint,
  [AllergyDefNum] bigint,
  [PatNum] bigint,
  [Reaction] varchar(255),
  [StatusIsActive] tinyint,
  [DateTStamp] datetime2,
  [DateAdverseReaction] date,
  [SnomedReaction] varchar(255),
  PRIMARY KEY ([AllergyNum])
);
GO

CREATE TABLE [appointment] (
  [AptNum] bigint,
  [PatNum] bigint,
  [AptStatus] tinyint,
  [Pattern] varchar(255),
  [Confirmed] bigint,
  [TimeLocked] tinyint,
  [Op] bigint,
  [Note] varchar(max),
  [ProvNum] bigint,
  [ProvHyg] bigint,
  [AptDateTime] datetime,
  [NextAptNum] bigint,
  [UnschedStatus] bigint,
  [IsNewPatient] tinyint,
  [ProcDescript] varchar(max),
  [Assistant] bigint,
  [ClinicNum] bigint,
  [IsHygiene] tinyint,
  [DateTStamp] datetime2,
  [DateTimeArrived] datetime,
  [DateTimeSeated] datetime,
  [DateTimeDismissed] datetime,
  [InsPlan1] bigint,
  [InsPlan2] bigint,
  [DateTimeAskedToArrive] datetime,
  [ProcsColored] varchar(max),
  [ColorOverride] int,
  [AppointmentTypeNum] bigint,
  [SecUserNumEntry] bigint,
  [SecDateTEntry] datetime,
  [Priority] tinyint,
  [ProvBarText] varchar(60),
  [PatternSecondary] varchar(255),
  [SecurityHash] varchar(255),
  [ItemOrderPlanned] int,
  [IsMirrored] tinyint,
  PRIMARY KEY ([AptNum])
);
GO

CREATE TABLE [apptfield] (
  [ApptFieldNum] bigint,
  [AptNum] bigint,
  [FieldName] varchar(255),
  [FieldValue] varchar(max),
  PRIMARY KEY ([ApptFieldNum])
);
GO

CREATE TABLE [apptgeneralmessagesent] (
  [ApptGeneralMessageSentNum] bigint,
  [ApptNum] bigint,
  [PatNum] bigint,
  [ClinicNum] bigint,
  [DateTimeEntry] datetime,
  [TSPrior] bigint,
  [ApptReminderRuleNum] bigint,
  [SendStatus] tinyint,
  [ApptDateTime] datetime,
  [MessageType] tinyint,
  [MessageFk] bigint,
  [DateTimeSent] datetime,
  [ResponseDescript] varchar(max),
  PRIMARY KEY ([ApptGeneralMessageSentNum])
);
GO

CREATE TABLE [apptnewpatthankyousent] (
  [ApptNewPatThankYouSentNum] bigint,
  [ApptNum] bigint,
  [ApptDateTime] datetime,
  [ApptSecDateTEntry] datetime,
  [TSPrior] bigint,
  [ApptReminderRuleNum] bigint,
  [ClinicNum] bigint,
  [PatNum] bigint,
  [ResponseDescript] varchar(max),
  [DateTimeNewPatThankYouTransmit] datetime,
  [ShortGUID] varchar(255),
  [SendStatus] tinyint,
  [MessageType] tinyint,
  [MessageFk] bigint,
  [DateTimeEntry] datetime,
  [DateTimeSent] datetime,
  PRIMARY KEY ([ApptNewPatThankYouSentNum])
);
GO

CREATE TABLE [apptreminderrule] (
  [ApptReminderRuleNum] bigint,
  [TypeCur] tinyint,
  [TSPrior] bigint,
  [SendOrder] varchar(255),
  [IsSendAll] tinyint,
  [TemplateSMS] varchar(max),
  [TemplateEmailSubject] varchar(max),
  [TemplateEmail] varchar(max),
  [ClinicNum] bigint,
  [TemplateSMSAggShared] varchar(max),
  [TemplateSMSAggPerAppt] varchar(max),
  [TemplateEmailSubjAggShared] varchar(max),
  [TemplateEmailAggShared] varchar(max),
  [TemplateEmailAggPerAppt] varchar(max),
  [DoNotSendWithin] bigint,
  [IsEnabled] tinyint,
  [TemplateAutoReply] varchar(max),
  [TemplateAutoReplyAgg] varchar(max),
  [IsAutoReplyEnabled] tinyint,
  [Language] varchar(255),
  [TemplateComeInMessage] varchar(max),
  [EmailTemplateType] varchar(255),
  [AggEmailTemplateType] varchar(255),
  [IsSendForMinorsBirthday] tinyint,
  [EmailHostingTemplateNum] bigint,
  [MinorAge] int,
  [TemplateFailureAutoReply] varchar(max),
  [SendMultipleInvites] tinyint,
  [TimeSpanMultipleInvites] bigint,
  PRIMARY KEY ([ApptReminderRuleNum])
);
GO

CREATE TABLE [apptremindersent] (
  [ApptReminderSentNum] bigint,
  [ApptNum] bigint,
  [ApptDateTime] datetime,
  [DateTimeSent] datetime,
  [TSPrior] bigint,
  [ApptReminderRuleNum] bigint,
  [PatNum] bigint,
  [ClinicNum] bigint,
  [SendStatus] tinyint,
  [MessageType] tinyint,
  [MessageFk] bigint,
  [DateTimeEntry] datetime,
  [ResponseDescript] varchar(max),
  PRIMARY KEY ([ApptReminderSentNum])
);
GO

CREATE TABLE [apptthankyousent] (
  [ApptThankYouSentNum] bigint,
  [ApptNum] bigint,
  [ApptDateTime] datetime,
  [ApptSecDateTEntry] datetime,
  [TSPrior] bigint,
  [ApptReminderRuleNum] bigint,
  [ClinicNum] bigint,
  [PatNum] bigint,
  [ResponseDescript] varchar(max),
  [DateTimeThankYouTransmit] datetime,
  [ShortGUID] varchar(255),
  [SendStatus] tinyint,
  [DoNotResend] tinyint,
  [MessageType] tinyint,
  [MessageFk] bigint,
  [DateTimeEntry] datetime,
  [DateTimeSent] datetime,
  PRIMARY KEY ([ApptThankYouSentNum])
);
GO

CREATE TABLE [apptview] (
  [ApptViewNum] bigint,
  [Description] varchar(255),
  [ItemOrder] smallint,
  [RowsPerIncr] tinyint,
  [OnlyScheduledProvs] tinyint,
  [OnlySchedBeforeTime] time,
  [OnlySchedAfterTime] time,
  [StackBehavUR] tinyint,
  [StackBehavLR] tinyint,
  [ClinicNum] bigint,
  [ApptTimeScrollStart] time,
  [IsScrollStartDynamic] tinyint,
  [IsApptBubblesDisabled] tinyint,
  [WidthOpMinimum] smallint,
  [WaitingRmName] tinyint,
  [OnlyScheduledProvDays] tinyint,
  [ShowMirroredAppts] tinyint,
  PRIMARY KEY ([ApptViewNum])
);
GO

CREATE TABLE [apptviewitem] (
  [ApptViewItemNum] bigint,
  [ApptViewNum] bigint,
  [OpNum] bigint,
  [ProvNum] bigint,
  [ElementDesc] varchar(255),
  [ElementOrder] tinyint,
  [ElementColor] int,
  [ElementAlignment] tinyint,
  [ApptFieldDefNum] bigint,
  [PatFieldDefNum] bigint,
  [IsMobile] tinyint,
  PRIMARY KEY ([ApptViewItemNum])
);
GO

CREATE TABLE [asapcomm] (
  [AsapCommNum] bigint,
  [FKey] bigint,
  [FKeyType] tinyint,
  [ScheduleNum] bigint,
  [PatNum] bigint,
  [ClinicNum] bigint,
  [ShortGUID] varchar(255),
  [DateTimeEntry] datetime,
  [DateTimeExpire] datetime,
  [DateTimeSmsScheduled] datetime,
  [SmsSendStatus] tinyint,
  [EmailSendStatus] tinyint,
  [DateTimeSmsSent] datetime,
  [DateTimeEmailSent] datetime,
  [EmailMessageNum] bigint,
  [ResponseStatus] tinyint,
  [DateTimeOrig] datetime,
  [TemplateText] varchar(max),
  [TemplateEmail] varchar(max),
  [TemplateEmailSubj] varchar(100),
  [Note] varchar(max),
  [GuidMessageToMobile] varchar(255),
  [EmailTemplateType] varchar(255),
  [UserNum] bigint,
  PRIMARY KEY ([AsapCommNum])
);
GO

CREATE TABLE [autocodecond] (
  [AutoCodeCondNum] bigint,
  [AutoCodeItemNum] bigint,
  [Cond] tinyint,
  PRIMARY KEY ([AutoCodeCondNum])
);
GO

CREATE TABLE [autocodeitem] (
  [AutoCodeItemNum] bigint,
  [AutoCodeNum] bigint,
  [OldCode] varchar(15),
  [CodeNum] bigint,
  PRIMARY KEY ([AutoCodeItemNum])
);
GO

CREATE TABLE [benefit] (
  [BenefitNum] bigint,
  [PlanNum] bigint,
  [PatPlanNum] bigint,
  [CovCatNum] bigint,
  [BenefitType] tinyint,
  [Percent] tinyint,
  [MonetaryAmt] float,
  [TimePeriod] tinyint,
  [QuantityQualifier] tinyint,
  [Quantity] tinyint,
  [CodeNum] bigint,
  [CoverageLevel] int,
  [SecDateTEntry] datetime,
  [SecDateTEdit] datetime2,
  [CodeGroupNum] bigint,
  [TreatArea] tinyint,
  [ToothRange] varchar(255),
  PRIMARY KEY ([BenefitNum])
);
GO

CREATE TABLE [branding] (
  [BrandingNum] bigint,
  [BrandingType] tinyint,
  [ClinicNum] bigint,
  [ValueString] varchar(max),
  [DateTimeUpdated] datetime,
  PRIMARY KEY ([BrandingNum])
);
GO

CREATE TABLE [carecreditwebresponse] (
  [CareCreditWebResponseNum] bigint,
  [PatNum] bigint,
  [PayNum] bigint,
  [RefNumber] varchar(255),
  [Amount] float,
  [WebToken] varchar(255),
  [ProcessingStatus] varchar(255),
  [DateTimeEntry] datetime,
  [DateTimePending] datetime,
  [DateTimeCompleted] datetime,
  [DateTimeExpired] datetime,
  [DateTimeLastError] datetime,
  [LastResponseStr] varchar(max),
  [ClinicNum] bigint,
  [ServiceType] varchar(255),
  [TransType] varchar(255),
  [MerchantNumber] varchar(20),
  [HasLogged] tinyint,
  PRIMARY KEY ([CareCreditWebResponseNum])
);
GO

CREATE TABLE [carrier] (
  [CarrierNum] bigint,
  [CarrierName] varchar(255),
  [Address] varchar(255),
  [Address2] varchar(255),
  [City] varchar(255),
  [State] varchar(255),
  [Zip] varchar(255),
  [Phone] varchar(255),
  [ElectID] varchar(255),
  [NoSendElect] tinyint,
  [IsCDA] tinyint,
  [CDAnetVersion] varchar(100),
  [CanadianNetworkNum] bigint,
  [IsHidden] tinyint,
  [CanadianEncryptionMethod] tinyint,
  [CanadianSupportedTypes] int,
  [SecUserNumEntry] bigint,
  [SecDateEntry] date,
  [SecDateTEdit] datetime2,
  [TIN] varchar(255),
  [CarrierGroupName] bigint,
  [ApptTextBackColor] int,
  [IsCoinsuranceInverted] tinyint,
  [TrustedEtransFlags] tinyint,
  [CobInsPaidBehaviorOverride] tinyint,
  [EraAutomationOverride] tinyint,
  [OrthoInsPayConsolidate] tinyint,
  [PaySuiteTransSup] tinyint,
  PRIMARY KEY ([CarrierNum]),
  UNIQUE ([ElectID])
);
GO

CREATE TABLE [cdspermission] (
  [CDSPermissionNum] bigint,
  [UserNum] bigint,
  [SetupCDS] tinyint,
  [ShowCDS] tinyint,
  [ShowInfobutton] tinyint,
  [EditBibliography] tinyint,
  [ProblemCDS] tinyint,
  [MedicationCDS] tinyint,
  [AllergyCDS] tinyint,
  [DemographicCDS] tinyint,
  [LabTestCDS] tinyint,
  [VitalCDS] tinyint,
  PRIMARY KEY ([CDSPermissionNum])
);
GO

CREATE TABLE [certemployee] (
  [CertEmployeeNum] bigint,
  [CertNum] bigint,
  [EmployeeNum] bigint,
  [DateCompleted] date,
  [Note] varchar(255),
  [UserNum] bigint,
  PRIMARY KEY ([CertEmployeeNum])
);
GO

CREATE TABLE [chatattach] (
  [ChatAttachNum] bigint,
  [ChatMsgNum] bigint,
  [FileName] varchar(255),
  [Thumbnail] varbinary(max),
  [FileData] varbinary(max),
  PRIMARY KEY ([ChatAttachNum])
);
GO

CREATE TABLE [chatmsg] (
  [ChatMsgNum] bigint,
  [ChatNum] bigint,
  [UserNum] bigint,
  [DateTimeSent] datetime,
  [Message] varchar(max),
  [SeqCount] bigint,
  [Quote] bigint,
  [EventType] tinyint,
  [IsImportant] tinyint,
  PRIMARY KEY ([ChatMsgNum])
);
GO

CREATE TABLE [chatreaction] (
  [ChatReactionNum] bigint,
  [ChatMsgNum] bigint,
  [UserNum] bigint,
  [EmojiName] varchar(255),
  PRIMARY KEY ([ChatReactionNum])
);
GO

CREATE TABLE [chatuserattach] (
  [ChatUserAttachNum] bigint,
  [UserNum] bigint,
  [ChatNum] bigint,
  [IsRead] tinyint,
  [DateTimeRemoved] datetime,
  [IsMute] tinyint,
  PRIMARY KEY ([ChatUserAttachNum])
);
GO

CREATE TABLE [chatuserod] (
  [ChatUserodNum] bigint,
  [UserNum] bigint,
  [UserStatus] tinyint,
  [DateTimeStatusReset] datetime,
  [Photo] varchar(max),
  [PhotoCrop] varchar(255),
  [OpenBackground] tinyint,
  [CloseKeepRunning] tinyint,
  [MuteNotifications] tinyint,
  [DismissNotifySecs] int,
  [MuteImportantNotifications] tinyint,
  [DismissImportantNotifySecs] int,
  PRIMARY KEY ([ChatUserodNum])
);
GO

CREATE TABLE [claim] (
  [ClaimNum] bigint,
  [PatNum] bigint,
  [DateService] date,
  [DateSent] date,
  [ClaimStatus] char(1),
  [DateReceived] date,
  [PlanNum] bigint,
  [ProvTreat] bigint,
  [ClaimFee] float,
  [InsPayEst] float,
  [InsPayAmt] float,
  [DedApplied] float,
  [PreAuthString] varchar(40),
  [IsProsthesis] char(1),
  [PriorDate] date,
  [ReasonUnderPaid] varchar(255),
  [ClaimNote] varchar(400),
  [ClaimType] varchar(255),
  [ProvBill] bigint,
  [ReferringProv] bigint,
  [RefNumString] varchar(40),
  [PlaceService] tinyint,
  [AccidentRelated] char(1),
  [AccidentDate] date,
  [AccidentST] varchar(2),
  [EmployRelated] tinyint,
  [IsOrtho] tinyint,
  [OrthoRemainM] tinyint,
  [OrthoDate] date,
  [PatRelat] tinyint,
  [PlanNum2] bigint,
  [PatRelat2] tinyint,
  [WriteOff] float,
  [Radiographs] tinyint,
  [ClinicNum] bigint,
  [ClaimForm] bigint,
  [AttachedImages] int,
  [AttachedModels] int,
  [AttachedFlags] varchar(255),
  [AttachmentID] varchar(255),
  [CanadianMaterialsForwarded] varchar(10),
  [CanadianReferralProviderNum] varchar(20),
  [CanadianReferralReason] tinyint,
  [CanadianIsInitialLower] varchar(5),
  [CanadianDateInitialLower] date,
  [CanadianMandProsthMaterial] tinyint,
  [CanadianIsInitialUpper] varchar(5),
  [CanadianDateInitialUpper] date,
  [CanadianMaxProsthMaterial] tinyint,
  [InsSubNum] bigint,
  [InsSubNum2] bigint,
  [CanadaTransRefNum] varchar(255),
  [CanadaEstTreatStartDate] date,
  [CanadaInitialPayment] float,
  [CanadaPaymentMode] tinyint,
  [CanadaTreatDuration] tinyint,
  [CanadaNumAnticipatedPayments] tinyint,
  [CanadaAnticipatedPayAmount] float,
  [PriorAuthorizationNumber] varchar(255),
  [SpecialProgramCode] tinyint,
  [UniformBillType] varchar(255),
  [MedType] tinyint,
  [AdmissionTypeCode] varchar(255),
  [AdmissionSourceCode] varchar(255),
  [PatientStatusCode] varchar(255),
  [CustomTracking] bigint,
  [DateResent] date,
  [CorrectionType] tinyint,
  [ClaimIdentifier] varchar(255),
  [OrigRefNum] varchar(255),
  [ProvOrderOverride] bigint,
  [OrthoTotalM] tinyint,
  [ShareOfCost] float,
  [SecUserNumEntry] bigint,
  [SecDateEntry] date,
  [SecDateTEdit] datetime2,
  [OrderingReferralNum] bigint,
  [DateSentOrig] date,
  [DateIllnessInjuryPreg] date,
  [DateIllnessInjuryPregQualifier] smallint,
  [DateOther] date,
  [DateOtherQualifier] smallint,
  [IsOutsideLab] tinyint,
  [SecurityHash] varchar(255),
  [Narrative] varchar(max),
  PRIMARY KEY ([ClaimNum])
);
GO

CREATE TABLE [claimattach] (
  [ClaimAttachNum] bigint,
  [ClaimNum] bigint,
  [DisplayedFileName] varchar(255),
  [ActualFileName] varchar(255),
  [ImageReferenceId] int,
  PRIMARY KEY ([ClaimAttachNum])
);
GO

CREATE TABLE [claimcondcodelog] (
  [ClaimCondCodeLogNum] bigint,
  [ClaimNum] bigint,
  [Code0] varchar(2),
  [Code1] varchar(2),
  [Code2] varchar(2),
  [Code3] varchar(2),
  [Code4] varchar(2),
  [Code5] varchar(2),
  [Code6] varchar(2),
  [Code7] varchar(2),
  [Code8] varchar(2),
  [Code9] varchar(2),
  [Code10] varchar(2),
  PRIMARY KEY ([ClaimCondCodeLogNum])
);
GO

CREATE TABLE [claimpayment] (
  [ClaimPaymentNum] bigint,
  [CheckDate] date,
  [CheckAmt] float,
  [CheckNum] varchar(25),
  [BankBranch] varchar(25),
  [Note] varchar(255),
  [ClinicNum] bigint,
  [DepositNum] bigint,
  [CarrierName] varchar(255),
  [DateIssued] date,
  [IsPartial] tinyint,
  [PayType] bigint,
  [SecUserNumEntry] bigint,
  [SecDateEntry] date,
  [SecDateTEdit] datetime2,
  [PayGroup] bigint,
  PRIMARY KEY ([ClaimPaymentNum])
);
GO

CREATE TABLE [claimproc] (
  [ClaimProcNum] bigint,
  [ProcNum] bigint,
  [ClaimNum] bigint,
  [PatNum] bigint,
  [ProvNum] bigint,
  [FeeBilled] float,
  [InsPayEst] float,
  [DedApplied] float,
  [Status] tinyint,
  [InsPayAmt] float,
  [Remarks] varchar(255),
  [ClaimPaymentNum] bigint,
  [PlanNum] bigint,
  [DateCP] date,
  [WriteOff] float,
  [CodeSent] varchar(15),
  [AllowedOverride] float,
  [Percentage] tinyint,
  [PercentOverride] tinyint,
  [CopayAmt] float,
  [NoBillIns] tinyint,
  [PaidOtherIns] float,
  [BaseEst] float,
  [CopayOverride] float,
  [ProcDate] date,
  [DateEntry] date,
  [LineNumber] tinyint,
  [DedEst] float,
  [DedEstOverride] float,
  [InsEstTotal] float,
  [InsEstTotalOverride] float,
  [PaidOtherInsOverride] float,
  [EstimateNote] varchar(255),
  [WriteOffEst] float,
  [WriteOffEstOverride] float,
  [ClinicNum] bigint,
  [InsSubNum] bigint,
  [PaymentRow] int,
  [PayPlanNum] bigint,
  [ClaimPaymentTracking] bigint,
  [SecUserNumEntry] bigint,
  [SecDateEntry] date,
  [SecDateTEdit] datetime2,
  [DateSuppReceived] date,
  [DateInsFinalized] date,
  [IsTransfer] tinyint,
  [ClaimAdjReasonCodes] varchar(255),
  [IsOverpay] tinyint,
  [SecurityHash] varchar(255),
  PRIMARY KEY ([ClaimProcNum])
);
GO

CREATE TABLE [claimsnapshot] (
  [ClaimSnapshotNum] bigint,
  [ProcNum] bigint,
  [ClaimType] varchar(255),
  [Writeoff] float,
  [InsPayEst] float,
  [Fee] float,
  [DateTEntry] datetime,
  [ClaimProcNum] bigint,
  [SnapshotTrigger] tinyint,
  PRIMARY KEY ([ClaimSnapshotNum])
);
GO

CREATE TABLE [claimtracking] (
  [ClaimTrackingNum] bigint,
  [ClaimNum] bigint,
  [TrackingType] varchar(255),
  [UserNum] bigint,
  [DateTimeEntry] datetime2,
  [Note] varchar(max),
  [TrackingDefNum] bigint,
  [TrackingErrorDefNum] bigint,
  PRIMARY KEY ([ClaimTrackingNum])
);
GO

CREATE TABLE [claimvalcodelog] (
  [ClaimValCodeLogNum] bigint,
  [ClaimNum] bigint,
  [ClaimField] varchar(5),
  [ValCode] char(2),
  [ValAmount] float,
  [Ordinal] int,
  PRIMARY KEY ([ClaimValCodeLogNum])
);
GO

CREATE TABLE [clearinghouse] (
  [ClearinghouseNum] bigint,
  [Description] varchar(255),
  [ExportPath] varchar(max),
  [Payors] varchar(max),
  [Eformat] tinyint,
  [ISA05] varchar(255),
  [SenderTIN] varchar(255),
  [ISA07] varchar(255),
  [ISA08] varchar(255),
  [ISA15] varchar(255),
  [Password] varchar(255),
  [ResponsePath] varchar(255),
  [CommBridge] tinyint,
  [ClientProgram] varchar(255),
  [LastBatchNumber] smallint,
  [ModemPort] tinyint,
  [LoginID] varchar(255),
  [SenderName] varchar(255),
  [SenderTelephone] varchar(255),
  [GS03] varchar(255),
  [ISA02] varchar(10),
  [ISA04] varchar(10),
  [ISA16] varchar(2),
  [SeparatorData] varchar(2),
  [SeparatorSegment] varchar(2),
  [ClinicNum] bigint,
  [HqClearinghouseNum] bigint,
  [IsEraDownloadAllowed] tinyint,
  [IsClaimExportAllowed] tinyint,
  [IsAttachmentSendAllowed] tinyint,
  [LocationID] varchar(255),
  [EnableXConnect] tinyint,
  PRIMARY KEY ([ClearinghouseNum])
);
GO

CREATE TABLE [clinic] (
  [ClinicNum] bigint,
  [Description] varchar(255),
  [Address] varchar(255),
  [Address2] varchar(255),
  [City] varchar(255),
  [State] varchar(255),
  [Zip] varchar(255),
  [Phone] varchar(255),
  [BankNumber] varchar(255),
  [DefaultPlaceService] tinyint,
  [InsBillingProv] bigint,
  [Fax] varchar(50),
  [EmailAddressNum] bigint,
  [DefaultProv] bigint,
  [SmsContractDate] datetime,
  [SmsMonthlyLimit] float,
  [IsMedicalOnly] tinyint,
  [BillingAddress] varchar(255),
  [BillingAddress2] varchar(255),
  [BillingCity] varchar(255),
  [BillingState] varchar(255),
  [BillingZip] varchar(255),
  [PayToAddress] varchar(255),
  [PayToAddress2] varchar(255),
  [PayToCity] varchar(255),
  [PayToState] varchar(255),
  [PayToZip] varchar(255),
  [UseBillAddrOnClaims] tinyint,
  [Region] bigint,
  [ItemOrder] int,
  [IsInsVerifyExcluded] tinyint,
  [Abbr] varchar(255),
  [MedLabAccountNum] varchar(255),
  [IsConfirmEnabled] tinyint,
  [IsConfirmDefault] tinyint,
  [IsNewPatApptExcluded] tinyint,
  [IsHidden] tinyint,
  [ExternalID] bigint,
  [SchedNote] varchar(255),
  [HasProcOnRx] tinyint,
  [TimeZone] varchar(75),
  [EmailAliasOverride] varchar(255),
  PRIMARY KEY ([ClinicNum])
);
GO

CREATE TABLE [clinicerx] (
  [ClinicErxNum] bigint,
  [PatNum] bigint,
  [ClinicDesc] varchar(255),
  [ClinicNum] bigint,
  [EnabledStatus] tinyint,
  [ClinicId] varchar(255),
  [ClinicKey] varchar(255),
  [AccountId] varchar(25),
  [RegistrationKeyNum] bigint,
  PRIMARY KEY ([ClinicErxNum])
);
GO

CREATE TABLE [clinicpref] (
  [ClinicPrefNum] bigint,
  [ClinicNum] bigint,
  [PrefName] varchar(255),
  [ValueString] varchar(max),
  PRIMARY KEY ([ClinicPrefNum])
);
GO

CREATE TABLE [clockevent] (
  [ClockEventNum] bigint,
  [EmployeeNum] bigint,
  [TimeEntered1] datetime,
  [TimeDisplayed1] datetime,
  [ClockStatus] tinyint,
  [Note] varchar(max),
  [TimeEntered2] datetime,
  [TimeDisplayed2] datetime,
  [OTimeHours] time,
  [OTimeAuto] time,
  [Adjust] time,
  [AdjustAuto] time,
  [AdjustIsOverridden] tinyint,
  [Rate2Hours] time,
  [Rate2Auto] time,
  [ClinicNum] bigint,
  [Rate3Hours] time,
  [Rate3Auto] time,
  [IsWorkingHome] tinyint,
  PRIMARY KEY ([ClockEventNum])
);
GO

CREATE TABLE [cloudaddress] (
  [CloudAddressNum] bigint,
  [IpAddress] varchar(50),
  [UserNumLastConnect] bigint,
  [DateTimeLastConnect] datetime,
  PRIMARY KEY ([CloudAddressNum])
);
GO

CREATE TABLE [commlog] (
  [CommlogNum] bigint,
  [PatNum] bigint,
  [CommDateTime] datetime,
  [CommType] bigint,
  [Note] varchar(max),
  [Mode_] tinyint,
  [SentOrReceived] tinyint,
  [UserNum] bigint,
  [Signature] varchar(max),
  [SigIsTopaz] tinyint,
  [DateTStamp] datetime2,
  [DateTimeEnd] datetime,
  [CommSource] tinyint,
  [ProgramNum] bigint,
  [DateTEntry] datetime,
  [ReferralNum] bigint,
  [CommReferralBehavior] tinyint,
  PRIMARY KEY ([CommlogNum])
);
GO

CREATE TABLE [commoptout] (
  [CommOptOutNum] bigint,
  [PatNum] bigint,
  [OptOutSms] int,
  [OptOutEmail] int,
  PRIMARY KEY ([CommOptOutNum])
);
GO

CREATE TABLE [computerpref] (
  [ComputerPrefNum] bigint,
  [ComputerName] varchar(64),
  [GraphicsUseHardware] tinyint,
  [GraphicsSimple] tinyint,
  [SensorType] varchar(255),
  [SensorBinned] tinyint,
  [SensorPort] int,
  [SensorExposure] int,
  [GraphicsDoubleBuffering] tinyint,
  [PreferredPixelFormatNum] int,
  [AtoZpath] varchar(255),
  [TaskKeepListHidden] tinyint,
  [TaskDock] int,
  [TaskX] int,
  [TaskY] int,
  [DirectXFormat] varchar(255),
  [ScanDocSelectSource] tinyint,
  [ScanDocShowOptions] tinyint,
  [ScanDocDuplex] tinyint,
  [ScanDocGrayscale] tinyint,
  [ScanDocResolution] int,
  [ScanDocQuality] tinyint,
  [ClinicNum] bigint,
  [ApptViewNum] bigint,
  [RecentApptView] tinyint,
  [PatSelectSearchMode] tinyint,
  [NoShowLanguage] tinyint,
  [NoShowDecimal] tinyint,
  [ComputerOS] varchar(255),
  [HelpButtonXAdjustment] float,
  [GraphicsUseDirectX11] tinyint,
  [Zoom] int,
  [VideoRectangle] varchar(255),
  [CreditCardTerminalId] varchar(255),
  PRIMARY KEY ([ComputerPrefNum])
);
GO

CREATE TABLE [confirmationrequest] (
  [ConfirmationRequestNum] bigint,
  [ClinicNum] bigint,
  [PatNum] bigint,
  [ApptNum] bigint,
  [DateTimeConfirmExpire] datetime,
  [ShortGUID] varchar(255),
  [ConfirmCode] varchar(255),
  [DateTimeEntry] datetime,
  [DateTimeConfirmTransmit] datetime,
  [DateTimeRSVP] datetime,
  [RSVPStatus] tinyint,
  [ResponseDescript] varchar(max),
  [GuidMessageFromMobile] varchar(255),
  [ApptDateTime] datetime,
  [TSPrior] bigint,
  [DoNotResend] tinyint,
  [SendStatus] tinyint,
  [ApptReminderRuleNum] bigint,
  [MessageType] tinyint,
  [MessageFk] bigint,
  [DateTimeSent] datetime,
  PRIMARY KEY ([ConfirmationRequestNum]),
  UNIQUE ([GuidMessageFromMobile])
);
GO

CREATE TABLE [creditcard] (
  [CreditCardNum] bigint,
  [PatNum] bigint,
  [Address] varchar(255),
  [Zip] varchar(255),
  [XChargeToken] varchar(255),
  [CCNumberMasked] varchar(255),
  [CCExpiration] date,
  [ItemOrder] int,
  [ChargeAmt] float,
  [DateStart] date,
  [DateStop] date,
  [Note] varchar(255),
  [PayPlanNum] bigint,
  [PayConnectToken] varchar(255),
  [PayConnectTokenExp] date,
  [Procedures] varchar(max),
  [CCSource] tinyint,
  [ClinicNum] bigint,
  [ExcludeProcSync] tinyint,
  [PaySimpleToken] varchar(255),
  [ChargeFrequency] varchar(150),
  [CanChargeWhenNoBal] tinyint,
  [PaymentType] bigint,
  [IsRecurringActive] tinyint,
  [Nickname] varchar(255),
  [CardHolderName] varchar(255),
  PRIMARY KEY ([CreditCardNum])
);
GO

CREATE TABLE [custrefentry] (
  [CustRefEntryNum] bigint,
  [PatNumCust] bigint,
  [PatNumRef] bigint,
  [DateEntry] date,
  [Note] varchar(255),
  PRIMARY KEY ([CustRefEntryNum])
);
GO

CREATE TABLE [custreference] (
  [CustReferenceNum] bigint,
  [PatNum] bigint,
  [DateMostRecent] date,
  [Note] varchar(255),
  [IsBadRef] tinyint,
  PRIMARY KEY ([CustReferenceNum])
);
GO

CREATE TABLE [dashboardcell] (
  [DashboardCellNum] bigint,
  [DashboardLayoutNum] bigint,
  [CellRow] int,
  [CellColumn] int,
  [CellType] varchar(255),
  [CellSettings] varchar(max),
  [LastQueryTime] datetime,
  [LastQueryData] varchar(max),
  [RefreshRateSeconds] int,
  PRIMARY KEY ([DashboardCellNum])
);
GO

CREATE TABLE [dashboardlayout] (
  [DashboardLayoutNum] bigint,
  [UserNum] bigint,
  [UserGroupNum] bigint,
  [DashboardTabName] varchar(255),
  [DashboardTabOrder] int,
  [DashboardRows] int,
  [DashboardColumns] int,
  [DashboardGroupName] varchar(255),
  PRIMARY KEY ([DashboardLayoutNum])
);
GO

CREATE TABLE [dbmlog] (
  [DbmLogNum] bigint,
  [UserNum] bigint,
  [FKey] bigint,
  [FKeyType] tinyint,
  [ActionType] tinyint,
  [DateTimeEntry] datetime,
  [MethodName] varchar(255),
  [LogText] varchar(max),
  PRIMARY KEY ([DbmLogNum])
);
GO

CREATE TABLE [discountplan] (
  [DiscountPlanNum] bigint,
  [Description] varchar(255),
  [FeeSchedNum] bigint,
  [DefNum] bigint,
  [IsHidden] tinyint,
  [PlanNote] varchar(max),
  [ExamFreqLimit] int,
  [XrayFreqLimit] int,
  [ProphyFreqLimit] int,
  [FluorideFreqLimit] int,
  [PerioFreqLimit] int,
  [LimitedExamFreqLimit] int,
  [PAFreqLimit] int,
  [AnnualMax] float,
  PRIMARY KEY ([DiscountPlanNum])
);
GO

CREATE TABLE [discountplansub] (
  [DiscountSubNum] bigint,
  [DiscountPlanNum] bigint,
  [PatNum] bigint,
  [DateEffective] date,
  [DateTerm] date,
  [SubNote] varchar(max)
);
GO

CREATE TABLE [disease] (
  [DiseaseNum] bigint,
  [PatNum] bigint,
  [DiseaseDefNum] bigint,
  [PatNote] varchar(max),
  [DateTStamp] datetime2,
  [ProbStatus] tinyint,
  [DateStart] date,
  [DateStop] date,
  [SnomedProblemType] varchar(255),
  [FunctionStatus] tinyint,
  PRIMARY KEY ([DiseaseNum])
);
GO

CREATE TABLE [dispsupply] (
  [DispSupplyNum] bigint,
  [SupplyNum] bigint,
  [ProvNum] bigint,
  [DateDispensed] date,
  [DispQuantity] float,
  [Note] varchar(max),
  PRIMARY KEY ([DispSupplyNum])
);
GO

CREATE TABLE [document] (
  [DocNum] bigint,
  [Description] varchar(255),
  [DateCreated] datetime,
  [DocCategory] bigint,
  [PatNum] bigint,
  [FileName] varchar(255),
  [ImgType] tinyint,
  [IsFlipped] tinyint,
  [DegreesRotated] float,
  [ToothNumbers] varchar(255),
  [Note] varchar(max),
  [SigIsTopaz] tinyint,
  [Signature] varchar(max),
  [CropX] int,
  [CropY] int,
  [CropW] int,
  [CropH] int,
  [WindowingMin] int,
  [WindowingMax] int,
  [MountItemNum] bigint,
  [DateTStamp] datetime2,
  [RawBase64] varchar(max),
  [Thumbnail] varchar(max),
  [ExternalGUID] varchar(255),
  [ExternalSource] varchar(255),
  [ProvNum] bigint,
  [IsCropOld] tinyint,
  [OcrResponseData] varchar(max),
  [ImageCaptureType] tinyint,
  [PrintHeading] tinyint,
  [ChartLetterStatus] tinyint,
  [UserNum] bigint,
  [ChartLetterHash] varchar(255),
  PRIMARY KEY ([DocNum])
);
GO

CREATE TABLE [dunning] (
  [DunningNum] bigint,
  [DunMessage] varchar(max),
  [BillingType] bigint,
  [AgeAccount] tinyint,
  [InsIsPending] tinyint,
  [MessageBold] varchar(max),
  [EmailSubject] varchar(255),
  [EmailBody] varchar(max),
  [DaysInAdvance] int,
  [ClinicNum] bigint,
  [IsSuperFamily] tinyint,
  PRIMARY KEY ([DunningNum])
);
GO

CREATE TABLE [ebill] (
  [EbillNum] bigint,
  [ClinicNum] bigint,
  [ClientAcctNumber] varchar(255),
  [ElectUserName] varchar(255),
  [ElectPassword] varchar(255),
  [PracticeAddress] tinyint,
  [RemitAddress] tinyint,
  PRIMARY KEY ([EbillNum])
);
GO

CREATE TABLE [eclipboardimagecapture] (
  [EClipboardImageCaptureNum] bigint,
  [PatNum] bigint,
  [DefNum] bigint,
  [IsSelfPortrait] tinyint,
  [DateTimeUpserted] datetime,
  [DocNum] bigint,
  [OcrCaptureType] tinyint,
  PRIMARY KEY ([EClipboardImageCaptureNum])
);
GO

CREATE TABLE [eclipboardimagecapturedef] (
  [EClipboardImageCaptureDefNum] bigint,
  [DefNum] bigint,
  [IsSelfPortrait] tinyint,
  [FrequencyDays] int,
  [ClinicNum] bigint,
  [OcrCaptureType] tinyint,
  [Frequency] tinyint,
  [ResubmitInterval] bigint,
  PRIMARY KEY ([EClipboardImageCaptureDefNum])
);
GO

CREATE TABLE [eclipboardsheetdef] (
  [EClipboardSheetDefNum] bigint,
  [SheetDefNum] bigint,
  [ClinicNum] bigint,
  [ResubmitInterval] bigint,
  [ItemOrder] int,
  [PrefillStatus] tinyint,
  [MinAge] int,
  [MaxAge] int,
  [IgnoreSheetDefNums] varchar(max),
  [PrefillStatusOverride] bigint,
  [EFormDefNum] bigint,
  [Frequency] tinyint,
  [SheetDefNumsConsidered] varchar(255),
  PRIMARY KEY ([EClipboardSheetDefNum])
);
GO

CREATE TABLE [eduresource] (
  [EduResourceNum] bigint,
  [DiseaseDefNum] bigint,
  [MedicationNum] bigint,
  [LabResultID] varchar(255),
  [LabResultName] varchar(255),
  [LabResultCompare] varchar(255),
  [ResourceUrl] varchar(255),
  [SmokingSnoMed] varchar(30),
  PRIMARY KEY ([EduResourceNum])
);
GO

CREATE TABLE [ehramendment] (
  [EhrAmendmentNum] bigint,
  [PatNum] bigint,
  [IsAccepted] tinyint,
  [Description] varchar(max),
  [Source] tinyint,
  [SourceName] varchar(max),
  [FileName] varchar(255),
  [RawBase64] varchar(max),
  [DateTRequest] datetime,
  [DateTAcceptDeny] datetime,
  [DateTAppend] datetime,
  PRIMARY KEY ([EhrAmendmentNum])
);
GO

CREATE TABLE [ehraptobs] (
  [EhrAptObsNum] bigint,
  [AptNum] bigint,
  [IdentifyingCode] tinyint,
  [ValType] tinyint,
  [ValReported] varchar(255),
  [UcumCode] varchar(255),
  [ValCodeSystem] varchar(255),
  PRIMARY KEY ([EhrAptObsNum])
);
GO

CREATE TABLE [ehrcareplan] (
  [EhrCarePlanNum] bigint,
  [PatNum] bigint,
  [SnomedEducation] varchar(255),
  [Instructions] varchar(255),
  [DatePlanned] date,
  PRIMARY KEY ([EhrCarePlanNum])
);
GO

CREATE TABLE [ehrlab] (
  [EhrLabNum] bigint,
  [PatNum] bigint,
  [OrderControlCode] varchar(255),
  [PlacerOrderNum] varchar(255),
  [PlacerOrderNamespace] varchar(255),
  [PlacerOrderUniversalID] varchar(255),
  [PlacerOrderUniversalIDType] varchar(255),
  [FillerOrderNum] varchar(255),
  [FillerOrderNamespace] varchar(255),
  [FillerOrderUniversalID] varchar(255),
  [FillerOrderUniversalIDType] varchar(255),
  [PlacerGroupNum] varchar(255),
  [PlacerGroupNamespace] varchar(255),
  [PlacerGroupUniversalID] varchar(255),
  [PlacerGroupUniversalIDType] varchar(255),
  [OrderingProviderID] varchar(255),
  [OrderingProviderLName] varchar(255),
  [OrderingProviderFName] varchar(255),
  [OrderingProviderMiddleNames] varchar(255),
  [OrderingProviderSuffix] varchar(255),
  [OrderingProviderPrefix] varchar(255),
  [OrderingProviderAssigningAuthorityNamespaceID] varchar(255),
  [OrderingProviderAssigningAuthorityUniversalID] varchar(255),
  [OrderingProviderAssigningAuthorityIDType] varchar(255),
  [OrderingProviderNameTypeCode] varchar(255),
  [OrderingProviderIdentifierTypeCode] varchar(255),
  [SetIdOBR] bigint,
  [UsiID] varchar(255),
  [UsiText] varchar(255),
  [UsiCodeSystemName] varchar(255),
  [UsiIDAlt] varchar(255),
  [UsiTextAlt] varchar(255),
  [UsiCodeSystemNameAlt] varchar(255),
  [UsiTextOriginal] varchar(255),
  [ObservationDateTimeStart] varchar(255),
  [ObservationDateTimeEnd] varchar(255),
  [SpecimenActionCode] varchar(255),
  [ResultDateTime] varchar(255),
  [ResultStatus] varchar(255),
  [ParentObservationID] varchar(255),
  [ParentObservationText] varchar(255),
  [ParentObservationCodeSystemName] varchar(255),
  [ParentObservationIDAlt] varchar(255),
  [ParentObservationTextAlt] varchar(255),
  [ParentObservationCodeSystemNameAlt] varchar(255),
  [ParentObservationTextOriginal] varchar(255),
  [ParentObservationSubID] varchar(255),
  [ParentPlacerOrderNum] varchar(255),
  [ParentPlacerOrderNamespace] varchar(255),
  [ParentPlacerOrderUniversalID] varchar(255),
  [ParentPlacerOrderUniversalIDType] varchar(255),
  [ParentFillerOrderNum] varchar(255),
  [ParentFillerOrderNamespace] varchar(255),
  [ParentFillerOrderUniversalID] varchar(255),
  [ParentFillerOrderUniversalIDType] varchar(255),
  [ListEhrLabResultsHandlingF] tinyint,
  [ListEhrLabResultsHandlingN] tinyint,
  [TQ1SetId] bigint,
  [TQ1DateTimeStart] varchar(255),
  [TQ1DateTimeEnd] varchar(255),
  [IsCpoe] tinyint,
  [OriginalPIDSegment] varchar(max),
  PRIMARY KEY ([EhrLabNum])
);
GO

CREATE TABLE [ehrlabclinicalinfo] (
  [EhrLabClinicalInfoNum] bigint,
  [EhrLabNum] bigint,
  [ClinicalInfoID] varchar(255),
  [ClinicalInfoText] varchar(255),
  [ClinicalInfoCodeSystemName] varchar(255),
  [ClinicalInfoIDAlt] varchar(255),
  [ClinicalInfoTextAlt] varchar(255),
  [ClinicalInfoCodeSystemNameAlt] varchar(255),
  [ClinicalInfoTextOriginal] varchar(255),
  PRIMARY KEY ([EhrLabClinicalInfoNum])
);
GO

CREATE TABLE [ehrlabimage] (
  [EhrLabImageNum] bigint,
  [EhrLabNum] bigint,
  [DocNum] bigint,
  PRIMARY KEY ([EhrLabImageNum])
);
GO

CREATE TABLE [ehrlabnote] (
  [EhrLabNoteNum] bigint,
  [EhrLabNum] bigint,
  [EhrLabResultNum] bigint,
  [Comments] varchar(max),
  PRIMARY KEY ([EhrLabNoteNum])
);
GO

CREATE TABLE [ehrlabresult] (
  [EhrLabResultNum] bigint,
  [EhrLabNum] bigint,
  [SetIdOBX] bigint,
  [ValueType] varchar(255),
  [ObservationIdentifierID] varchar(255),
  [ObservationIdentifierText] varchar(255),
  [ObservationIdentifierCodeSystemName] varchar(255),
  [ObservationIdentifierIDAlt] varchar(255),
  [ObservationIdentifierTextAlt] varchar(255),
  [ObservationIdentifierCodeSystemNameAlt] varchar(255),
  [ObservationIdentifierTextOriginal] varchar(255),
  [ObservationIdentifierSub] varchar(255),
  [ObservationValueCodedElementID] varchar(255),
  [ObservationValueCodedElementText] varchar(255),
  [ObservationValueCodedElementCodeSystemName] varchar(255),
  [ObservationValueCodedElementIDAlt] varchar(255),
  [ObservationValueCodedElementTextAlt] varchar(255),
  [ObservationValueCodedElementCodeSystemNameAlt] varchar(255),
  [ObservationValueCodedElementTextOriginal] varchar(255),
  [ObservationValueDateTime] varchar(255),
  [ObservationValueTime] time,
  [ObservationValueComparator] varchar(255),
  [ObservationValueNumber1] float,
  [ObservationValueSeparatorOrSuffix] varchar(255),
  [ObservationValueNumber2] float,
  [ObservationValueNumeric] float,
  [ObservationValueText] varchar(255),
  [UnitsID] varchar(255),
  [UnitsText] varchar(255),
  [UnitsCodeSystemName] varchar(255),
  [UnitsIDAlt] varchar(255),
  [UnitsTextAlt] varchar(255),
  [UnitsCodeSystemNameAlt] varchar(255),
  [UnitsTextOriginal] varchar(255),
  [referenceRange] varchar(255),
  [AbnormalFlags] varchar(255),
  [ObservationResultStatus] varchar(255),
  [ObservationDateTime] varchar(255),
  [AnalysisDateTime] varchar(255),
  [PerformingOrganizationName] varchar(255),
  [PerformingOrganizationNameAssigningAuthorityNamespaceId] varchar(255),
  [PerformingOrganizationNameAssigningAuthorityUniversalId] varchar(255),
  [PerformingOrganizationNameAssigningAuthorityUniversalIdType] varchar(255),
  [PerformingOrganizationIdentifierTypeCode] varchar(255),
  [PerformingOrganizationIdentifier] varchar(255),
  [PerformingOrganizationAddressStreet] varchar(255),
  [PerformingOrganizationAddressOtherDesignation] varchar(255),
  [PerformingOrganizationAddressCity] varchar(255),
  [PerformingOrganizationAddressStateOrProvince] varchar(255),
  [PerformingOrganizationAddressZipOrPostalCode] varchar(255),
  [PerformingOrganizationAddressCountryCode] varchar(255),
  [PerformingOrganizationAddressAddressType] varchar(255),
  [PerformingOrganizationAddressCountyOrParishCode] varchar(255),
  [MedicalDirectorID] varchar(255),
  [MedicalDirectorLName] varchar(255),
  [MedicalDirectorFName] varchar(255),
  [MedicalDirectorMiddleNames] varchar(255),
  [MedicalDirectorSuffix] varchar(255),
  [MedicalDirectorPrefix] varchar(255),
  [MedicalDirectorAssigningAuthorityNamespaceID] varchar(255),
  [MedicalDirectorAssigningAuthorityUniversalID] varchar(255),
  [MedicalDirectorAssigningAuthorityIDType] varchar(255),
  [MedicalDirectorNameTypeCode] varchar(255),
  [MedicalDirectorIdentifierTypeCode] varchar(255),
  PRIMARY KEY ([EhrLabResultNum])
);
GO

CREATE TABLE [ehrlabresultscopyto] (
  [EhrLabResultsCopyToNum] bigint,
  [EhrLabNum] bigint,
  [CopyToID] varchar(255),
  [CopyToLName] varchar(255),
  [CopyToFName] varchar(255),
  [CopyToMiddleNames] varchar(255),
  [CopyToSuffix] varchar(255),
  [CopyToPrefix] varchar(255),
  [CopyToAssigningAuthorityNamespaceID] varchar(255),
  [CopyToAssigningAuthorityUniversalID] varchar(255),
  [CopyToAssigningAuthorityIDType] varchar(255),
  [CopyToNameTypeCode] varchar(255),
  [CopyToIdentifierTypeCode] varchar(255),
  PRIMARY KEY ([EhrLabResultsCopyToNum])
);
GO

CREATE TABLE [ehrlabspecimen] (
  [EhrLabSpecimenNum] bigint,
  [EhrLabNum] bigint,
  [SetIdSPM] bigint,
  [SpecimenTypeID] varchar(255),
  [SpecimenTypeText] varchar(255),
  [SpecimenTypeCodeSystemName] varchar(255),
  [SpecimenTypeIDAlt] varchar(255),
  [SpecimenTypeTextAlt] varchar(255),
  [SpecimenTypeCodeSystemNameAlt] varchar(255),
  [SpecimenTypeTextOriginal] varchar(255),
  [CollectionDateTimeStart] varchar(255),
  [CollectionDateTimeEnd] varchar(255),
  PRIMARY KEY ([EhrLabSpecimenNum])
);
GO

CREATE TABLE [ehrlabspecimencondition] (
  [EhrLabSpecimenConditionNum] bigint,
  [EhrLabSpecimenNum] bigint,
  [SpecimenConditionID] varchar(255),
  [SpecimenConditionText] varchar(255),
  [SpecimenConditionCodeSystemName] varchar(255),
  [SpecimenConditionIDAlt] varchar(255),
  [SpecimenConditionTextAlt] varchar(255),
  [SpecimenConditionCodeSystemNameAlt] varchar(255),
  [SpecimenConditionTextOriginal] varchar(255),
  PRIMARY KEY ([EhrLabSpecimenConditionNum])
);
GO

CREATE TABLE [ehrlabspecimenrejectreason] (
  [EhrLabSpecimenRejectReasonNum] bigint,
  [EhrLabSpecimenNum] bigint,
  [SpecimenRejectReasonID] varchar(255),
  [SpecimenRejectReasonText] varchar(255),
  [SpecimenRejectReasonCodeSystemName] varchar(255),
  [SpecimenRejectReasonIDAlt] varchar(255),
  [SpecimenRejectReasonTextAlt] varchar(255),
  [SpecimenRejectReasonCodeSystemNameAlt] varchar(255),
  [SpecimenRejectReasonTextOriginal] varchar(255),
  PRIMARY KEY ([EhrLabSpecimenRejectReasonNum])
);
GO

CREATE TABLE [ehrmeasureevent] (
  [EhrMeasureEventNum] bigint,
  [DateTEvent] datetime,
  [EventType] tinyint,
  [PatNum] bigint,
  [MoreInfo] varchar(255),
  [CodeValueEvent] varchar(30),
  [CodeSystemEvent] varchar(30),
  [CodeValueResult] varchar(30),
  [CodeSystemResult] varchar(30),
  [FKey] bigint,
  [TobaccoCessationDesire] tinyint,
  [DateStartTobacco] date,
  PRIMARY KEY ([EhrMeasureEventNum]),
  UNIQUE ([CodeValueResult])
);
GO

CREATE TABLE [ehrcode] (
  [CodeValue] varchar(30),
  PRIMARY KEY ([CodeValue])
);
GO

CREATE TABLE [ehrnotperformed] (
  [EhrNotPerformedNum] bigint,
  [PatNum] bigint,
  [ProvNum] bigint,
  [CodeValue] varchar(30),
  [CodeSystem] varchar(255),
  [CodeValueReason] varchar(30),
  [CodeSystemReason] varchar(255),
  [Note] varchar(max),
  [DateEntry] date,
  PRIMARY KEY ([EhrNotPerformedNum])
);
GO

CREATE TABLE [ehrpatient] (
  [PatNum] bigint,
  [MotherMaidenFname] varchar(255),
  [MotherMaidenLname] varchar(255),
  [VacShareOk] tinyint,
  [MedicaidState] varchar(50),
  [SexualOrientation] varchar(255),
  [GenderIdentity] varchar(255),
  [SexualOrientationNote] varchar(255),
  [GenderIdentityNote] varchar(255),
  [DischargeDate] datetime
);
GO

CREATE TABLE [ehrprovkey] (
  [EhrProvKeyNum] bigint,
  [PatNum] bigint,
  [LName] varchar(255),
  [FName] varchar(255),
  [ProvKey] varchar(255),
  [FullTimeEquiv] float,
  [Notes] varchar(max),
  [YearValue] int,
  PRIMARY KEY ([EhrProvKeyNum])
);
GO

CREATE TABLE [ehrquarterlykey] (
  [EhrQuarterlyKeyNum] bigint,
  [YearValue] int,
  [QuarterValue] int,
  [PracticeName] varchar(255),
  [KeyValue] varchar(255),
  [PatNum] bigint,
  [Notes] varchar(max),
  PRIMARY KEY ([EhrQuarterlyKeyNum])
);
GO

CREATE TABLE [ehrsummaryccd] (
  [EhrSummaryCcdNum] bigint,
  [PatNum] bigint,
  [DateSummary] date,
  [ContentSummary] varchar(max),
  [EmailAttachNum] bigint,
  PRIMARY KEY ([EhrSummaryCcdNum])
);
GO

CREATE TABLE [emailaddress] (
  [EmailAddressNum] bigint,
  [SMTPserver] varchar(255),
  [EmailUsername] varchar(255),
  [EmailPassword] varchar(255),
  [ServerPort] int,
  [UseSSL] tinyint,
  [SenderAddress] varchar(255),
  [Pop3ServerIncoming] varchar(255),
  [ServerPortIncoming] int,
  [UserNum] bigint,
  [AccessToken] varchar(2000),
  [RefreshToken] varchar(max),
  [DownloadInbox] tinyint,
  [QueryString] varchar(1000),
  [AuthenticationType] tinyint,
  PRIMARY KEY ([EmailAddressNum])
);
GO

CREATE TABLE [emailattach] (
  [EmailAttachNum] bigint,
  [EmailMessageNum] bigint,
  [DisplayedFileName] varchar(255),
  [ActualFileName] varchar(255),
  [EmailTemplateNum] bigint,
  PRIMARY KEY ([EmailAttachNum])
);
GO

CREATE TABLE [emailhostingtemplate] (
  [EmailHostingTemplateNum] bigint,
  [TemplateName] varchar(255),
  [Subject] varchar(max),
  [BodyPlainText] varchar(max),
  [BodyHTML] varchar(max),
  [TemplateId] bigint,
  [ClinicNum] bigint,
  [EmailTemplateType] varchar(255),
  [TemplateType] varchar(255),
  PRIMARY KEY ([EmailHostingTemplateNum])
);
GO

CREATE TABLE [emailmessage] (
  [EmailMessageNum] bigint,
  [PatNum] bigint,
  [ToAddress] varchar(max),
  [FromAddress] varchar(max),
  [Subject] varchar(max),
  [BodyText] varchar(max),
  [MsgDateTime] datetime,
  [SentOrReceived] tinyint,
  [RecipientAddress] varchar(255),
  [RawEmailIn] varchar(max),
  [ProvNumWebMail] bigint,
  [PatNumSubj] bigint,
  [CcAddress] varchar(max),
  [BccAddress] varchar(max),
  [HideIn] tinyint,
  [AptNum] bigint,
  [UserNum] bigint,
  [HtmlType] tinyint,
  [SecDateTEntry] datetime,
  [SecDateTEdit] datetime2,
  [MsgType] varchar(255),
  [FailReason] varchar(max),
  PRIMARY KEY ([EmailMessageNum])
);
GO

CREATE TABLE [emailsecure] (
  [EmailSecureNum] bigint,
  [ClinicNum] bigint,
  [PatNum] bigint,
  [EmailMessageNum] bigint,
  [EmailChainFK] bigint,
  [EmailFK] bigint,
  [DateTEntry] datetime,
  [SecDateTEdit] datetime2,
  PRIMARY KEY ([EmailSecureNum])
);
GO

CREATE TABLE [emailsecureattach] (
  [EmailSecureAttachNum] bigint,
  [ClinicNum] bigint,
  [EmailAttachNum] bigint,
  [EmailSecureNum] bigint,
  [AttachmentGuid] varchar(50),
  [DisplayedFileName] varchar(255),
  [Extension] varchar(255),
  [DateTEntry] datetime,
  [SecDateTEdit] datetime2,
  PRIMARY KEY ([EmailSecureAttachNum])
);
GO

CREATE TABLE [encounter] (
  [EncounterNum] bigint,
  [PatNum] bigint,
  [ProvNum] bigint,
  [CodeValue] varchar(30),
  [CodeSystem] varchar(255),
  [Note] varchar(max),
  [DateEncounter] date,
  PRIMARY KEY ([EncounterNum])
);
GO

CREATE TABLE [entrylog] (
  [EntryLogNum] bigint,
  [UserNum] bigint,
  [FKeyType] tinyint,
  [FKey] bigint,
  [LogSource] tinyint,
  [EntryDateTime] datetime,
  PRIMARY KEY ([EntryLogNum])
);
GO

CREATE TABLE [eobattach] (
  [EobAttachNum] bigint,
  [ClaimPaymentNum] bigint,
  [DateTCreated] datetime,
  [FileName] varchar(255),
  [RawBase64] varchar(max),
  [ClaimNumPreAuth] bigint,
  PRIMARY KEY ([EobAttachNum])
);
GO

CREATE TABLE [equipment] (
  [EquipmentNum] bigint,
  [Description] varchar(max),
  [SerialNumber] varchar(255),
  [ModelYear] varchar(2),
  [DatePurchased] date,
  [DateSold] date,
  [PurchaseCost] float,
  [MarketValue] float,
  [Location] varchar(max),
  [DateEntry] date,
  [ProvNumCheckedOut] bigint,
  [DateCheckedOut] date,
  [DateExpectedBack] date,
  [DispenseNote] varchar(max),
  [Status] varchar(max),
  PRIMARY KEY ([EquipmentNum])
);
GO

CREATE TABLE [erouting] (
  [ERoutingNum] bigint,
  [Description] varchar(255),
  [PatNum] bigint,
  [ClinicNum] bigint,
  [SecDateTEntry] datetime,
  [IsComplete] tinyint,
  PRIMARY KEY ([ERoutingNum])
);
GO

CREATE TABLE [eroutingaction] (
  [ERoutingActionNum] bigint,
  [ERoutingNum] bigint,
  [ItemOrder] int,
  [ERoutingActionType] tinyint,
  [UserNum] bigint,
  [IsComplete] tinyint,
  [DateTimeComplete] datetime,
  [ForeignKeyType] tinyint,
  [ForeignKey] bigint,
  [LabelOverride] varchar(255),
  PRIMARY KEY ([ERoutingActionNum])
);
GO

CREATE TABLE [eroutingactiondef] (
  [ERoutingActionDefNum] bigint,
  [ERoutingDefNum] bigint,
  [ERoutingActionType] tinyint,
  [ItemOrder] int,
  [SecDateTEntry] datetime,
  [DateTLastModified] datetime,
  [ForeignKeyType] tinyint,
  [ForeignKey] bigint,
  [LabelOverride] varchar(255),
  PRIMARY KEY ([ERoutingActionDefNum])
);
GO

CREATE TABLE [eroutingdef] (
  [ERoutingDefNum] bigint,
  [ClinicNum] bigint,
  [Description] varchar(255),
  [UserNumCreated] bigint,
  [UserNumModified] bigint,
  [SecDateTEntered] datetime,
  [DateLastModified] datetime,
  PRIMARY KEY ([ERoutingDefNum])
);
GO

CREATE TABLE [eroutingdeflink] (
  [ERoutingDefLinkNum] bigint,
  [ERoutingDefNum] bigint,
  [Fkey] bigint,
  [ERoutingType] tinyint,
  PRIMARY KEY ([ERoutingDefLinkNum])
);
GO

CREATE TABLE [erxlog] (
  [ErxLogNum] bigint,
  [PatNum] bigint,
  [MsgText] varchar(max),
  [DateTStamp] datetime2,
  [ProvNum] bigint,
  [UserNum] bigint,
  PRIMARY KEY ([ErxLogNum])
);
GO

CREATE TABLE [eservicelog] (
  [EServiceLogNum] bigint,
  [LogDateTime] datetime,
  [PatNum] bigint,
  [EServiceType] tinyint,
  [EServiceAction] smallint,
  [KeyType] smallint,
  [LogGuid] varchar(36),
  [ClinicNum] bigint,
  [FKey] bigint,
  [DateTimeUploaded] datetime,
  [Note] varchar(255),
  PRIMARY KEY ([EServiceLogNum])
);
GO

CREATE TABLE [etrans] (
  [EtransNum] bigint,
  [DateTimeTrans] datetime,
  [ClearingHouseNum] bigint,
  [Etype] tinyint,
  [ClaimNum] bigint,
  [OfficeSequenceNumber] int,
  [CarrierTransCounter] int,
  [CarrierTransCounter2] int,
  [CarrierNum] bigint,
  [CarrierNum2] bigint,
  [PatNum] bigint,
  [BatchNumber] int,
  [AckCode] varchar(255),
  [TransSetNum] int,
  [Note] varchar(max),
  [EtransMessageTextNum] bigint,
  [AckEtransNum] bigint,
  [PlanNum] bigint,
  [InsSubNum] bigint,
  [TranSetId835] varchar(255),
  [CarrierNameRaw] varchar(60),
  [PatientNameRaw] varchar(133),
  [UserNum] bigint,
  PRIMARY KEY ([EtransNum])
);
GO

CREATE TABLE [etrans835] (
  [Etrans835Num] bigint,
  [EtransNum] bigint,
  [PayerName] varchar(60),
  [TransRefNum] varchar(50),
  [InsPaid] float,
  [ControlId] varchar(9),
  [PaymentMethodCode] varchar(3),
  [PatientName] varchar(100),
  [Status] tinyint,
  [AutoProcessed] tinyint,
  [IsApproved] tinyint,
  PRIMARY KEY ([Etrans835Num])
);
GO

CREATE TABLE [etrans835attach] (
  [Etrans835AttachNum] bigint,
  [EtransNum] bigint,
  [ClaimNum] bigint,
  [ClpSegmentIndex] int,
  [DateTimeEntry] datetime,
  PRIMARY KEY ([Etrans835AttachNum])
);
GO

CREATE TABLE [evaluation] (
  [EvaluationNum] bigint,
  [InstructNum] bigint,
  [StudentNum] bigint,
  [SchoolCourseNum] bigint,
  [EvalTitle] varchar(255),
  [DateEval] date,
  [GradingScaleNum] bigint,
  [OverallGradeShowing] varchar(255),
  [OverallGradeNumber] float,
  [Notes] varchar(max),
  [GradeOverride] float,
  PRIMARY KEY ([EvaluationNum])
);
GO

CREATE TABLE [evaluationcriterion] (
  [EvaluationCriterionNum] bigint,
  [EvaluationNum] bigint,
  [CriterionDescript] varchar(255),
  [IsCategoryName] tinyint,
  [GradingScaleNum] bigint,
  [GradeShowing] varchar(255),
  [GradeNumber] float,
  [Notes] varchar(max),
  [ItemOrder] int,
  [MaxPointsPoss] float,
  PRIMARY KEY ([EvaluationCriterionNum])
);
GO

CREATE TABLE [famaging] (
  [PatNum] bigint,
  [Bal_0_30] float,
  [Bal_31_60] float,
  [Bal_61_90] float,
  [BalOver90] float,
  [InsEst] float,
  [BalTotal] float,
  [PayPlanDue] float
);
GO

CREATE TABLE [familyhealth] (
  [FamilyHealthNum] bigint,
  [PatNum] bigint,
  [Relationship] tinyint,
  [DiseaseDefNum] bigint,
  [PersonName] varchar(255),
  PRIMARY KEY ([FamilyHealthNum])
);
GO

CREATE TABLE [fee] (
  [FeeNum] bigint,
  [Amount] float,
  [OldCode] varchar(15),
  [FeeSched] bigint,
  [UseDefaultFee] tinyint,
  [UseDefaultCov] tinyint,
  [CodeNum] bigint,
  [ClinicNum] bigint,
  [ProvNum] bigint,
  [SecUserNumEntry] bigint,
  [SecDateEntry] date,
  [SecDateTEdit] datetime2,
  [DateEffective] date,
  PRIMARY KEY ([FeeNum])
);
GO

CREATE TABLE [feesched] (
  [FeeSchedNum] bigint,
  [Description] varchar(255),
  [FeeSchedType] int,
  [ItemOrder] int,
  [IsHidden] tinyint,
  [IsGlobal] tinyint,
  [SecUserNumEntry] bigint,
  [SecDateEntry] date,
  [SecDateTEdit] datetime2,
  PRIMARY KEY ([FeeSchedNum])
);
GO

CREATE TABLE [feeschedgroup] (
  [FeeSchedGroupNum] bigint,
  [Description] varchar(255),
  [FeeSchedNum] bigint,
  [ClinicNums] varchar(255),
  PRIMARY KEY ([FeeSchedGroupNum])
);
GO

CREATE TABLE [feeschednote] (
  [FeeSchedNoteNum] bigint,
  [FeeSchedNum] bigint,
  [ClinicNums] varchar(max),
  [Note] varchar(max),
  [DateEntry] date,
  [SecUserNumEntry] bigint,
  [SecDateEntry] date,
  [SecDateTEdit] datetime2,
  PRIMARY KEY ([FeeSchedNoteNum])
);
GO

CREATE TABLE [formpat] (
  [FormPatNum] bigint,
  [PatNum] bigint,
  [FormDateTime] datetime,
  PRIMARY KEY ([FormPatNum])
);
GO

CREATE TABLE [guardian] (
  [GuardianNum] bigint,
  [PatNumChild] bigint,
  [PatNumGuardian] bigint,
  [Relationship] tinyint,
  [IsGuardian] tinyint,
  PRIMARY KEY ([GuardianNum])
);
GO

CREATE TABLE [hieclinic] (
  [HieClinicNum] bigint,
  [ClinicNum] bigint,
  [SupportedCarrierFlags] tinyint,
  [PathExportCCD] varchar(255),
  [TimeOfDayExportCCD] bigint,
  [IsEnabled] tinyint,
  PRIMARY KEY ([HieClinicNum])
);
GO

CREATE TABLE [hiequeue] (
  [HieQueueNum] bigint,
  [PatNum] bigint,
  PRIMARY KEY ([HieQueueNum])
);
GO

CREATE TABLE [histappointment] (
  [HistApptNum] bigint,
  [HistUserNum] bigint,
  [HistDateTStamp] datetime,
  [HistApptAction] tinyint,
  [ApptSource] tinyint,
  [AptNum] bigint,
  [PatNum] bigint,
  [AptStatus] tinyint,
  [Pattern] varchar(255),
  [Confirmed] bigint,
  [TimeLocked] tinyint,
  [Op] bigint,
  [Note] varchar(max),
  [ProvNum] bigint,
  [ProvHyg] bigint,
  [AptDateTime] datetime,
  [NextAptNum] bigint,
  [UnschedStatus] bigint,
  [IsNewPatient] tinyint,
  [ProcDescript] varchar(max),
  [Assistant] bigint,
  [ClinicNum] bigint,
  [IsHygiene] tinyint,
  [DateTStamp] datetime2,
  [DateTimeArrived] datetime,
  [DateTimeSeated] datetime,
  [DateTimeDismissed] datetime,
  [InsPlan1] bigint,
  [InsPlan2] bigint,
  [DateTimeAskedToArrive] datetime,
  [ProcsColored] varchar(max),
  [ColorOverride] int,
  [AppointmentTypeNum] bigint,
  [SecUserNumEntry] bigint,
  [SecDateTEntry] datetime,
  [Priority] tinyint,
  [ProvBarText] varchar(60),
  [PatternSecondary] varchar(255),
  [SecurityHash] varchar(255),
  [ItemOrderPlanned] int,
  [IsMirrored] tinyint,
  PRIMARY KEY ([HistApptNum])
);
GO

CREATE TABLE [hl7msg] (
  [HL7MsgNum] bigint,
  [HL7Status] int,
  [MsgText] varchar(max),
  [AptNum] bigint,
  [DateTStamp] datetime2,
  [PatNum] bigint,
  [Note] varchar(max),
  PRIMARY KEY ([HL7MsgNum])
);
GO

CREATE TABLE [hl7procattach] (
  [HL7ProcAttachNum] bigint,
  [HL7MsgNum] bigint,
  [ProcNum] bigint,
  PRIMARY KEY ([HL7ProcAttachNum])
);
GO

CREATE TABLE [imagedraw] (
  [ImageDrawNum] bigint,
  [DocNum] bigint,
  [MountNum] bigint,
  [ColorDraw] int,
  [ColorBack] int,
  [DrawingSegment] varchar(max),
  [DrawText] varchar(255),
  [FontSize] float,
  [DrawType] tinyint,
  [ImageAnnotVendor] tinyint,
  [Details] varchar(max),
  [PearlLayer] tinyint,
  [BetterDiagLayer] tinyint,
  PRIMARY KEY ([ImageDrawNum])
);
GO

CREATE TABLE [insbluebook] (
  [InsBlueBookNum] bigint,
  [ProcCodeNum] bigint,
  [CarrierNum] bigint,
  [PlanNum] bigint,
  [GroupNum] varchar(25),
  [InsPayAmt] float,
  [AllowedOverride] float,
  [DateTEntry] datetime,
  [ProcNum] bigint,
  [ProcDate] date,
  [ClaimType] varchar(10),
  [ClaimNum] bigint,
  PRIMARY KEY ([InsBlueBookNum])
);
GO

CREATE TABLE [insbluebooklog] (
  [InsBlueBookLogNum] bigint,
  [ClaimProcNum] bigint,
  [AllowedFee] float,
  [DateTEntry] datetime,
  [Description] varchar(max),
  PRIMARY KEY ([InsBlueBookLogNum])
);
GO

CREATE TABLE [inseditlog] (
  [InsEditLogNum] bigint,
  [FKey] bigint,
  [LogType] tinyint,
  [FieldName] varchar(255),
  [OldValue] varchar(255),
  [NewValue] varchar(255),
  [UserNum] bigint,
  [DateTStamp] datetime2,
  [ParentKey] bigint,
  [Description] varchar(255),
  PRIMARY KEY ([InsEditLogNum])
);
GO

CREATE TABLE [inseditpatlog] (
  [InsEditPatLogNum] bigint,
  [FKey] bigint,
  [LogType] tinyint,
  [FieldName] varchar(255),
  [OldValue] varchar(255),
  [NewValue] varchar(255),
  [UserNum] bigint,
  [DateTStamp] datetime2,
  [ParentKey] bigint,
  [Description] varchar(255),
  PRIMARY KEY ([InsEditPatLogNum])
);
GO

CREATE TABLE [inspending] (
  [InsPendingNum] bigint,
  [PatNum] bigint,
  [PatNumSubscriber] bigint,
  [Ordinal] tinyint,
  [Relationship] tinyint,
  [GroupNum] varchar(255),
  [GroupName] varchar(255),
  [Employer] varchar(255),
  [SubscriberID] varchar(255),
  [Phone] varchar(255),
  [CarrierName] varchar(255),
  PRIMARY KEY ([InsPendingNum])
);
GO

CREATE TABLE [insplan] (
  [PlanNum] bigint,
  [GroupName] varchar(50),
  [GroupNum] varchar(50),
  [PlanNote] varchar(max),
  [FeeSched] bigint,
  [PlanType] char(1),
  [ClaimFormNum] bigint,
  [UseAltCode] tinyint,
  [ClaimsUseUCR] tinyint,
  [CopayFeeSched] bigint,
  [EmployerNum] bigint,
  [CarrierNum] bigint,
  [AllowedFeeSched] bigint,
  [TrojanID] varchar(100),
  [DivisionNo] varchar(255),
  [IsMedical] tinyint,
  [FilingCode] bigint,
  [DentaideCardSequence] tinyint,
  [ShowBaseUnits] tinyint,
  [CodeSubstNone] tinyint,
  [IsHidden] tinyint,
  [MonthRenew] tinyint,
  [FilingCodeSubtype] bigint,
  [CanadianPlanFlag] varchar(5),
  [CanadianDiagnosticCode] varchar(255),
  [CanadianInstitutionCode] varchar(255),
  [RxBIN] varchar(255),
  [CobRule] tinyint,
  [SopCode] varchar(255),
  [SecUserNumEntry] bigint,
  [SecDateEntry] date,
  [SecDateTEdit] datetime2,
  [HideFromVerifyList] tinyint,
  [OrthoType] tinyint,
  [OrthoAutoProcFreq] tinyint,
  [OrthoAutoProcCodeNumOverride] bigint,
  [OrthoAutoFeeBilled] float,
  [OrthoAutoClaimDaysWait] int,
  [BillingType] bigint,
  [HasPpoSubstWriteoffs] tinyint,
  [ExclusionFeeRule] tinyint,
  [ManualFeeSchedNum] bigint,
  [IsBlueBookEnabled] tinyint,
  [InsPlansZeroWriteOffsOnAnnualMaxOverride] tinyint,
  [InsPlansZeroWriteOffsOnFreqOrAgingOverride] tinyint,
  [PerVisitPatAmount] float,
  [PerVisitInsAmount] float,
  PRIMARY KEY ([PlanNum])
);
GO

CREATE TABLE [insplanpreference] (
  [InsPlanPrefNum] bigint,
  [PlanNum] bigint,
  [FKey] bigint,
  [FKeyType] tinyint,
  [ValueString] varchar(max),
  PRIMARY KEY ([InsPlanPrefNum])
);
GO

CREATE TABLE [inssub] (
  [InsSubNum] bigint,
  [PlanNum] bigint,
  [Subscriber] bigint,
  [DateEffective] date,
  [DateTerm] date,
  [ReleaseInfo] tinyint,
  [AssignBen] tinyint,
  [SubscriberID] varchar(255),
  [BenefitNotes] varchar(max),
  [SubscNote] varchar(max),
  [SecUserNumEntry] bigint,
  [SecDateEntry] date,
  [SecDateTEdit] datetime2,
  [SecurityHash] varchar(255),
  PRIMARY KEY ([InsSubNum])
);
GO

CREATE TABLE [installmentplan] (
  [InstallmentPlanNum] bigint,
  [PatNum] bigint,
  [DateAgreement] date,
  [DateFirstPayment] date,
  [MonthlyPayment] float,
  [APR] float,
  [Note] varchar(255),
  PRIMARY KEY ([InstallmentPlanNum])
);
GO

CREATE TABLE [insverify] (
  [InsVerifyNum] bigint,
  [DateLastVerified] date,
  [UserNum] bigint,
  [VerifyType] tinyint,
  [FKey] bigint,
  [DefNum] bigint,
  [Note] varchar(max),
  [DateLastAssigned] date,
  [DateTimeEntry] datetime,
  [HoursAvailableForVerification] float,
  [SecDateTEdit] datetime2,
  [SecurityHash] varchar(255),
  PRIMARY KEY ([InsVerifyNum])
);
GO

CREATE TABLE [insverifyhist] (
  [InsVerifyHistNum] bigint,
  [InsVerifyNum] bigint,
  [DateLastVerified] date,
  [UserNum] bigint,
  [VerifyType] tinyint,
  [FKey] bigint,
  [DefNum] bigint,
  [Note] varchar(max),
  [DateLastAssigned] date,
  [DateTimeEntry] datetime,
  [HoursAvailableForVerification] float,
  [VerifyUserNum] bigint,
  [SecDateTEdit] datetime2,
  [SecurityHash] varchar(255),
  PRIMARY KEY ([InsVerifyHistNum])
);
GO

CREATE TABLE [intervention] (
  [InterventionNum] bigint,
  [PatNum] bigint,
  [ProvNum] bigint,
  [CodeValue] varchar(30),
  [CodeSystem] varchar(255),
  [Note] varchar(max),
  [DateEntry] date,
  [CodeSet] tinyint,
  [IsPatDeclined] tinyint,
  PRIMARY KEY ([InterventionNum])
);
GO

CREATE TABLE [journalentry] (
  [JournalEntryNum] bigint,
  [TransactionNum] bigint,
  [AccountNum] bigint,
  [DateDisplayed] date,
  [DebitAmt] float,
  [CreditAmt] float,
  [Memo] varchar(max),
  [Splits] varchar(max),
  [CheckNumber] varchar(255),
  [ReconcileNum] bigint,
  [SecUserNumEntry] bigint,
  [SecDateTEntry] datetime,
  [SecUserNumEdit] bigint,
  [SecDateTEdit] datetime2,
  [Payee] varchar(255),
  [Notes] varchar(max),
  PRIMARY KEY ([JournalEntryNum])
);
GO

CREATE TABLE [labcase] (
  [LabCaseNum] bigint,
  [PatNum] bigint,
  [LaboratoryNum] bigint,
  [AptNum] bigint,
  [PlannedAptNum] bigint,
  [DateTimeDue] datetime,
  [DateTimeCreated] datetime,
  [DateTimeSent] datetime,
  [DateTimeRecd] datetime,
  [DateTimeChecked] datetime,
  [ProvNum] bigint,
  [Instructions] varchar(max),
  [LabFee] float,
  [DateTStamp] datetime2,
  [InvoiceNum] varchar(255),
  PRIMARY KEY ([LabCaseNum])
);
GO

CREATE TABLE [labpanel] (
  [LabPanelNum] bigint,
  [PatNum] bigint,
  [RawMessage] varchar(max),
  [LabNameAddress] varchar(255),
  [DateTStamp] datetime2,
  [SpecimenCondition] varchar(255),
  [SpecimenSource] varchar(255),
  [ServiceId] varchar(255),
  [ServiceName] varchar(255),
  [MedicalOrderNum] bigint,
  PRIMARY KEY ([LabPanelNum])
);
GO

CREATE TABLE [labresult] (
  [LabResultNum] bigint,
  [LabPanelNum] bigint,
  [DateTimeTest] datetime,
  [TestName] varchar(255),
  [DateTStamp] datetime2,
  [TestID] varchar(255),
  [ObsValue] varchar(255),
  [ObsUnits] varchar(255),
  [ObsRange] varchar(255),
  [AbnormalFlag] tinyint,
  PRIMARY KEY ([LabResultNum]),
  UNIQUE ([TestID])
);
GO

CREATE TABLE [medicalorder] (
  [MedicalOrderNum] bigint,
  [MedOrderType] tinyint,
  [PatNum] bigint,
  [DateTimeOrder] datetime,
  [Description] varchar(255),
  [IsDiscontinued] tinyint,
  [ProvNum] bigint,
  PRIMARY KEY ([MedicalOrderNum])
);
GO

CREATE TABLE [medicationpat] (
  [MedicationPatNum] bigint,
  [PatNum] bigint,
  [MedicationNum] bigint,
  [PatNote] varchar(max),
  [DateTStamp] datetime2,
  [DateStart] date,
  [DateStop] date,
  [ProvNum] bigint,
  [MedDescript] varchar(255),
  [RxCui] bigint,
  [ErxGuid] varchar(255),
  [IsCpoe] tinyint,
  PRIMARY KEY ([MedicationPatNum])
);
GO

CREATE TABLE [medlab] (
  [MedLabNum] bigint,
  [SendingApp] varchar(255),
  [SendingFacility] varchar(255),
  [PatNum] bigint,
  [ProvNum] bigint,
  [PatIDLab] varchar(255),
  [PatIDAlt] varchar(255),
  [PatAge] varchar(255),
  [PatAccountNum] varchar(255),
  [PatFasting] tinyint,
  [SpecimenID] varchar(255),
  [SpecimenIDFiller] varchar(255),
  [ObsTestID] varchar(255),
  [ObsTestDescript] varchar(255),
  [ObsTestLoinc] varchar(255),
  [ObsTestLoincText] varchar(255),
  [DateTimeCollected] datetime,
  [TotalVolume] varchar(255),
  [ActionCode] varchar(255),
  [ClinicalInfo] varchar(255),
  [DateTimeEntered] datetime,
  [OrderingProvNPI] varchar(255),
  [OrderingProvLocalID] varchar(255),
  [OrderingProvLName] varchar(255),
  [OrderingProvFName] varchar(255),
  [SpecimenIDAlt] varchar(255),
  [DateTimeReported] datetime,
  [ResultStatus] varchar(255),
  [ParentObsID] varchar(255),
  [ParentObsTestID] varchar(255),
  [NotePat] varchar(max),
  [NoteLab] varchar(max),
  [FileName] varchar(255),
  [OriginalPIDSegment] varchar(max),
  PRIMARY KEY ([MedLabNum]),
  UNIQUE ([PatAccountNum])
);
GO

CREATE TABLE [medlabfacattach] (
  [MedLabFacAttachNum] bigint,
  [MedLabNum] bigint,
  [MedLabResultNum] bigint,
  [MedLabFacilityNum] bigint,
  PRIMARY KEY ([MedLabFacAttachNum])
);
GO

CREATE TABLE [medlabresult] (
  [MedLabResultNum] bigint,
  [MedLabNum] bigint,
  [ObsID] varchar(255),
  [ObsText] varchar(255),
  [ObsLoinc] varchar(255),
  [ObsLoincText] varchar(255),
  [ObsIDSub] varchar(255),
  [ObsValue] varchar(max),
  [ObsSubType] varchar(255),
  [ObsUnits] varchar(255),
  [ReferenceRange] varchar(255),
  [AbnormalFlag] varchar(255),
  [ResultStatus] varchar(255),
  [DateTimeObs] datetime,
  [FacilityID] varchar(255),
  [DocNum] bigint,
  [Note] varchar(max),
  PRIMARY KEY ([MedLabResultNum])
);
GO

CREATE TABLE [medlabspecimen] (
  [MedLabSpecimenNum] bigint,
  [MedLabNum] bigint,
  [SpecimenID] varchar(255),
  [SpecimenDescript] varchar(255),
  [DateTimeCollected] datetime,
  PRIMARY KEY ([MedLabSpecimenNum])
);
GO

CREATE TABLE [mobileappdevice] (
  [MobileAppDeviceNum] bigint,
  [ClinicNum] bigint,
  [DeviceName] varchar(255),
  [UniqueID] varchar(255),
  [IsEclipboardEnabled] tinyint,
  [EclipboardLastAttempt] datetime,
  [EclipboardLastLogin] datetime,
  [PatNum] bigint,
  [LastCheckInActivity] datetime,
  [IsBYODDevice] tinyint,
  [DevicePage] tinyint,
  [UserNum] bigint,
  [IsODTouchEnabled] tinyint,
  [ODTouchLastLogin] datetime,
  [ODTouchLastAttempt] datetime,
  PRIMARY KEY ([MobileAppDeviceNum])
);
GO

CREATE TABLE [mobilebrandingprofile] (
  [MobileBrandingProfileNum] bigint,
  [ClinicNum] bigint,
  [OfficeDescription] varchar(255),
  [LogoFilePath] varchar(255),
  [DateTStamp] datetime2,
  PRIMARY KEY ([MobileBrandingProfileNum])
);
GO

CREATE TABLE [mount] (
  [MountNum] bigint,
  [PatNum] bigint,
  [DocCategory] bigint,
  [DateCreated] datetime,
  [Description] varchar(255),
  [Note] varchar(max),
  [Width] int,
  [Height] int,
  [ColorBack] int,
  [ProvNum] bigint,
  [ColorFore] int,
  [ColorTextBack] int,
  [FlipOnAcquire] tinyint,
  [AdjModeAfterSeries] tinyint,
  PRIMARY KEY ([MountNum])
);
GO

CREATE TABLE [mountitem] (
  [MountItemNum] bigint,
  [MountNum] bigint,
  [Xpos] int,
  [Ypos] int,
  [ItemOrder] int,
  [Width] int,
  [Height] int,
  [RotateOnAcquire] int,
  [ToothNumbers] varchar(255),
  [TextShowing] varchar(max),
  [FontSize] float,
  PRIMARY KEY ([MountItemNum])
);
GO

CREATE TABLE [msgtopaysent] (
  [MsgToPaySentNum] bigint,
  [PatNum] bigint,
  [ClinicNum] bigint,
  [SendStatus] tinyint,
  [Source] tinyint,
  [MessageType] tinyint,
  [MessageFk] bigint,
  [Subject] varchar(max),
  [Message] varchar(max),
  [EmailType] tinyint,
  [DateTimeEntry] datetime,
  [DateTimeSent] datetime,
  [ResponseDescript] varchar(max),
  [ApptReminderRuleNum] bigint,
  [ShortGUID] varchar(255),
  [DateTimeSendFailed] datetime,
  [ApptNum] bigint,
  [ApptDateTime] datetime,
  [TSPrior] bigint,
  [StatementNum] bigint
);
GO

CREATE TABLE [oidexternal] (
  [OIDExternalNum] bigint,
  [IDType] varchar(255),
  [IDInternal] bigint,
  [IDExternal] varchar(255),
  [rootExternal] varchar(255),
  PRIMARY KEY ([OIDExternalNum])
);
GO

CREATE TABLE [operatory] (
  [OperatoryNum] bigint,
  [OpName] varchar(255),
  [Abbrev] varchar(255),
  [ItemOrder] smallint,
  [IsHidden] tinyint,
  [ProvDentist] bigint,
  [ProvHygienist] bigint,
  [IsHygiene] tinyint,
  [ClinicNum] bigint,
  [DateTStamp] datetime2,
  [SetProspective] tinyint,
  [IsWebSched] tinyint,
  [IsNewPatAppt] tinyint,
  [OperatoryType] bigint,
  PRIMARY KEY ([OperatoryNum])
);
GO

CREATE TABLE [orthocase] (
  [OrthoCaseNum] bigint,
  [PatNum] bigint,
  [ProvNum] bigint,
  [ClinicNum] bigint,
  [Fee] float,
  [FeeInsPrimary] float,
  [FeePat] float,
  [BandingDate] date,
  [DebondDate] date,
  [DebondDateExpected] date,
  [IsTransfer] tinyint,
  [OrthoType] bigint,
  [SecDateTEntry] datetime,
  [SecUserNumEntry] bigint,
  [SecDateTEdit] datetime2,
  [IsActive] tinyint,
  [FeeInsSecondary] float,
  PRIMARY KEY ([OrthoCaseNum])
);
GO

CREATE TABLE [orthochart] (
  [OrthoChartNum] bigint,
  [PatNum] bigint,
  [DateService] date,
  [FieldName] varchar(255),
  [FieldValue] varchar(max),
  [UserNum] bigint,
  [ProvNum] bigint,
  [OrthoChartRowNum] bigint,
  PRIMARY KEY ([OrthoChartNum])
);
GO

CREATE TABLE [orthochartlog] (
  [OrthoChartLogNum] bigint,
  [PatNum] bigint,
  [ComputerName] varchar(255),
  [DateTimeLog] datetime,
  [DateTimeService] datetime,
  [UserNum] bigint,
  [ProvNum] bigint,
  [OrthoChartRowNum] bigint,
  [LogData] varchar(max),
  PRIMARY KEY ([OrthoChartLogNum])
);
GO

CREATE TABLE [orthochartrow] (
  [OrthoChartRowNum] bigint,
  [PatNum] bigint,
  [DateTimeService] datetime,
  [UserNum] bigint,
  [ProvNum] bigint,
  [Signature] varchar(max),
  PRIMARY KEY ([OrthoChartRowNum])
);
GO

CREATE TABLE [orthohardware] (
  [OrthoHardwareNum] bigint,
  [PatNum] bigint,
  [DateExam] date,
  [OrthoHardwareType] tinyint,
  [OrthoHardwareSpecNum] bigint,
  [ToothRange] varchar(255),
  [Note] varchar(255),
  [IsHidden] tinyint,
  PRIMARY KEY ([OrthoHardwareNum])
);
GO

CREATE TABLE [orthoplanlink] (
  [OrthoPlanLinkNum] bigint,
  [OrthoCaseNum] bigint,
  [LinkType] tinyint,
  [FKey] bigint,
  [IsActive] tinyint,
  [SecDateTEntry] datetime,
  [SecUserNumEntry] bigint,
  PRIMARY KEY ([OrthoPlanLinkNum])
);
GO

CREATE TABLE [orthoproclink] (
  [OrthoProcLinkNum] bigint,
  [OrthoCaseNum] bigint,
  [ProcNum] bigint,
  [SecDateTEntry] datetime,
  [SecUserNumEntry] bigint,
  [ProcLinkType] tinyint,
  PRIMARY KEY ([OrthoProcLinkNum])
);
GO

CREATE TABLE [patfield] (
  [PatFieldNum] bigint,
  [PatNum] bigint,
  [FieldName] varchar(255),
  [FieldValue] varchar(max),
  [SecUserNumEntry] bigint,
  [SecDateEntry] date,
  [SecDateTEdit] datetime2,
  PRIMARY KEY ([PatFieldNum])
);
GO

CREATE TABLE [patient] (
  [PatNum] bigint,
  [LName] varchar(100),
  [FName] varchar(100),
  [MiddleI] varchar(100),
  [Preferred] varchar(100),
  [PatStatus] tinyint,
  [Gender] tinyint,
  [Position] tinyint,
  [Birthdate] date,
  [SSN] varchar(100),
  [Address] varchar(100),
  [Address2] varchar(100),
  [City] varchar(100),
  [State] varchar(100),
  [Zip] varchar(100),
  [HmPhone] varchar(30),
  [WkPhone] varchar(30),
  [WirelessPhone] varchar(30),
  [Guarantor] bigint,
  [CreditType] char(1),
  [Email] varchar(100),
  [Salutation] varchar(100),
  [EstBalance] float,
  [PriProv] bigint,
  [SecProv] bigint,
  [FeeSched] bigint,
  [BillingType] bigint,
  [ImageFolder] varchar(100),
  [AddrNote] varchar(max),
  [FamFinUrgNote] varchar(max),
  [MedUrgNote] varchar(255),
  [ApptModNote] varchar(255),
  [StudentStatus] char(1),
  [SchoolName] varchar(255),
  [ChartNumber] varchar(100),
  [MedicaidID] varchar(20),
  [Bal_0_30] float,
  [Bal_31_60] float,
  [Bal_61_90] float,
  [BalOver90] float,
  [InsEst] float,
  [BalTotal] float,
  [EmployerNum] bigint,
  [EmploymentNote] varchar(255),
  [County] varchar(255),
  [GradeLevel] tinyint,
  [Urgency] tinyint,
  [DateFirstVisit] date,
  [ClinicNum] bigint,
  [HasIns] varchar(255),
  [TrophyFolder] varchar(255),
  [PlannedIsDone] tinyint,
  [Premed] tinyint,
  [Ward] varchar(255),
  [PreferConfirmMethod] tinyint,
  [PreferContactMethod] tinyint,
  [PreferRecallMethod] tinyint,
  [SchedBeforeTime] time,
  [SchedAfterTime] time,
  [SchedDayOfWeek] tinyint,
  [Language] varchar(100),
  [AdmitDate] date,
  [Title] varchar(15),
  [PayPlanDue] float,
  [SiteNum] bigint,
  [DateTStamp] datetime2,
  [ResponsParty] bigint,
  [CanadianEligibilityCode] tinyint,
  [AskToArriveEarly] int,
  [PreferContactConfidential] tinyint,
  [SuperFamily] bigint,
  [TxtMsgOk] tinyint,
  [SmokingSnoMed] varchar(32),
  [Country] varchar(255),
  [DateTimeDeceased] datetime,
  [BillingCycleDay] int,
  [SecUserNumEntry] bigint,
  [SecDateEntry] date,
  [HasSuperBilling] tinyint,
  [PatNumCloneFrom] bigint,
  [DiscountPlanNum] bigint,
  [HasSignedTil] tinyint,
  [ShortCodeOptIn] tinyint,
  [SecurityHash] varchar(255),
  PRIMARY KEY ([PatNum])
);
GO

CREATE TABLE [patientlink] (
  [PatientLinkNum] bigint,
  [PatNumFrom] bigint,
  [PatNumTo] bigint,
  [LinkType] tinyint,
  [DateTimeLink] datetime,
  PRIMARY KEY ([PatientLinkNum])
);
GO

CREATE TABLE [patientnote] (
  [PatNum] bigint,
  [FamFinancial] varchar(max),
  [ApptPhone] varchar(max),
  [Medical] varchar(max),
  [Service] varchar(max),
  [MedicalComp] varchar(max),
  [Treatment] varchar(max),
  [ICEName] varchar(255),
  [ICEPhone] varchar(30),
  [OrthoMonthsTreatOverride] int,
  [DateOrthoPlacementOverride] date,
  [SecDateTEntry] datetime,
  [SecDateTEdit] datetime2,
  [Consent] tinyint,
  [UserNumOrthoLocked] bigint,
  [Pronoun] tinyint
);
GO

CREATE TABLE [patientportalinvite] (
  [PatientPortalInviteNum] bigint,
  [PatNum] bigint,
  [ApptNum] bigint,
  [ClinicNum] bigint,
  [DateTimeEntry] datetime,
  [TSPrior] bigint,
  [SendStatus] tinyint,
  [MessageFk] bigint,
  [ResponseDescript] varchar(max),
  [MessageType] tinyint,
  [DateTimeSent] datetime,
  [ApptReminderRuleNum] bigint,
  [ApptDateTime] datetime,
  PRIMARY KEY ([PatientPortalInviteNum])
);
GO

CREATE TABLE [patientrace] (
  [PatientRaceNum] bigint,
  [PatNum] bigint,
  [Race] tinyint,
  [CdcrecCode] varchar(255),
  PRIMARY KEY ([PatientRaceNum])
);
GO

CREATE TABLE [patplan] (
  [PatPlanNum] bigint,
  [PatNum] bigint,
  [Ordinal] tinyint,
  [IsPending] tinyint,
  [Relationship] tinyint,
  [PatID] varchar(100),
  [InsSubNum] bigint,
  [OrthoAutoFeeBilledOverride] float,
  [OrthoAutoNextClaimDate] date,
  [SecDateTEntry] datetime,
  [SecDateTEdit] datetime2,
  PRIMARY KEY ([PatPlanNum])
);
GO

CREATE TABLE [patrestriction] (
  [PatRestrictionNum] bigint,
  [PatNum] bigint,
  [PatRestrictType] tinyint,
  PRIMARY KEY ([PatRestrictionNum])
);
GO

CREATE TABLE [payconnectresponseweb] (
  [PayConnectResponseWebNum] bigint,
  [PatNum] bigint,
  [PayNum] bigint,
  [AccountToken] varchar(255),
  [PaymentToken] varchar(255),
  [ProcessingStatus] varchar(255),
  [DateTimeEntry] datetime,
  [DateTimePending] datetime,
  [DateTimeCompleted] datetime,
  [DateTimeExpired] datetime,
  [DateTimeLastError] datetime,
  [LastResponseStr] varchar(max),
  [CCSource] tinyint,
  [Amount] float,
  [PayNote] varchar(255),
  [IsTokenSaved] tinyint,
  [PayToken] varchar(255),
  [ExpDateToken] varchar(255),
  [RefNumber] varchar(255),
  [TransType] varchar(255),
  [EmailResponse] varchar(255),
  [LogGuid] varchar(36),
  PRIMARY KEY ([PayConnectResponseWebNum])
);
GO

CREATE TABLE [payment] (
  [PayNum] bigint,
  [PayType] bigint,
  [PayDate] date,
  [PayAmt] float,
  [CheckNum] varchar(25),
  [BankBranch] varchar(25),
  [PayNote] varchar(max),
  [IsSplit] tinyint,
  [PatNum] bigint,
  [ClinicNum] bigint,
  [DateEntry] date,
  [DepositNum] bigint,
  [Receipt] varchar(max),
  [IsRecurringCC] tinyint,
  [SecUserNumEntry] bigint,
  [SecDateTEdit] datetime2,
  [PaymentSource] tinyint,
  [ProcessStatus] tinyint,
  [RecurringChargeDate] date,
  [ExternalId] varchar(255),
  [PaymentStatus] tinyint,
  [IsCcCompleted] tinyint,
  [MerchantFee] float,
  PRIMARY KEY ([PayNum])
);
GO

CREATE TABLE [payortype] (
  [PayorTypeNum] bigint,
  [PatNum] bigint,
  [DateStart] date,
  [SopCode] varchar(255),
  [Note] varchar(max),
  PRIMARY KEY ([PayorTypeNum])
);
GO

CREATE TABLE [payplan] (
  [PayPlanNum] bigint,
  [PatNum] bigint,
  [Guarantor] bigint,
  [PayPlanDate] date,
  [APR] float,
  [Note] varchar(max),
  [PlanNum] bigint,
  [CompletedAmt] float,
  [InsSubNum] bigint,
  [PaySchedule] tinyint,
  [NumberOfPayments] int,
  [PayAmt] float,
  [DownPayment] float,
  [IsClosed] tinyint,
  [Signature] varchar(max),
  [SigIsTopaz] tinyint,
  [PlanCategory] bigint,
  [IsDynamic] tinyint,
  [ChargeFrequency] tinyint,
  [DatePayPlanStart] date,
  [IsLocked] tinyint,
  [DateInterestStart] date,
  [DynamicPayPlanTPOption] tinyint,
  [MobileAppDeviceNum] bigint,
  [SecurityHash] varchar(255),
  [SheetDefNum] bigint,
  PRIMARY KEY ([PayPlanNum])
);
GO

CREATE TABLE [payplancharge] (
  [PayPlanChargeNum] bigint,
  [PayPlanNum] bigint,
  [Guarantor] bigint,
  [PatNum] bigint,
  [ChargeDate] date,
  [Principal] float,
  [Interest] float,
  [Note] varchar(max),
  [ProvNum] bigint,
  [ClinicNum] bigint,
  [ChargeType] tinyint,
  [ProcNum] bigint,
  [SecDateTEntry] datetime,
  [SecDateTEdit] datetime2,
  [StatementNum] bigint,
  [FKey] bigint,
  [LinkType] tinyint,
  [IsOffset] tinyint,
  [IsDownPayment] tinyint,
  PRIMARY KEY ([PayPlanChargeNum])
);
GO

CREATE TABLE [payplanlink] (
  [PayPlanLinkNum] bigint,
  [PayPlanNum] bigint,
  [LinkType] tinyint,
  [FKey] bigint,
  [AmountOverride] float,
  [SecDateTEntry] datetime,
  PRIMARY KEY ([PayPlanLinkNum])
);
GO

CREATE TABLE [payplantemplate] (
  [PayPlanTemplateNum] bigint,
  [PayPlanTemplateName] varchar(255),
  [ClinicNum] bigint,
  [APR] float,
  [InterestDelay] int,
  [PayAmt] float,
  [NumberOfPayments] int,
  [ChargeFrequency] tinyint,
  [DownPayment] float,
  [DynamicPayPlanTPOption] tinyint,
  [Note] varchar(255),
  [IsHidden] tinyint,
  [SheetDefNum] bigint,
  PRIMARY KEY ([PayPlanTemplateNum])
);
GO

CREATE TABLE [paysplit] (
  [SplitNum] bigint,
  [SplitAmt] float,
  [PatNum] bigint,
  [ProcDate] date,
  [PayNum] bigint,
  [IsDiscount] tinyint,
  [DiscountType] tinyint,
  [ProvNum] bigint,
  [PayPlanNum] bigint,
  [DatePay] date,
  [ProcNum] bigint,
  [DateEntry] date,
  [UnearnedType] bigint,
  [ClinicNum] bigint,
  [SecUserNumEntry] bigint,
  [SecDateTEdit] datetime2,
  [FSplitNum] bigint,
  [AdjNum] bigint,
  [PayPlanChargeNum] bigint,
  [PayPlanDebitType] tinyint,
  [SecurityHash] varchar(255),
  PRIMARY KEY ([SplitNum])
);
GO

CREATE TABLE [paysuitepayment] (
  [PaySuitePaymentNum] bigint,
  [PaymentId] varchar(255),
  [ProviderId] varchar(255),
  [PaymentMethod] varchar(255),
  [PaymentReference] varchar(255),
  [PaymentAmount] float,
  [PaymentDate] date,
  [PaymentStatus] varchar(255),
  [ReversalReasonCode] varchar(255),
  [AssociatedPaymentId] varchar(255),
  [PaySuitePaymentDetailNum] bigint,
  [HasUnresolvedClaimPayment] tinyint,
  [ReconciliationStatus] tinyint,
  [ClaimPaymentNum] bigint,
  PRIMARY KEY ([PaySuitePaymentNum])
);
GO

CREATE TABLE [payterminal] (
  [PayTerminalNum] bigint,
  [Name] varchar(255),
  [ClinicNum] bigint,
  [TerminalID] varchar(255),
  [CCIntegration] varchar(50),
  PRIMARY KEY ([PayTerminalNum])
);
GO

CREATE TABLE [pearlrequest] (
  [PearlRequestNum] bigint,
  [RequestId] varchar(255),
  [DocNum] bigint,
  [RequestStatus] tinyint,
  [DateTSent] date,
  [DateTChecked] date,
  PRIMARY KEY ([PearlRequestNum])
);
GO

CREATE TABLE [perioexam] (
  [PerioExamNum] bigint,
  [PatNum] bigint,
  [ExamDate] date,
  [ProvNum] bigint,
  [DateTMeasureEdit] datetime,
  [Note] varchar(max),
  PRIMARY KEY ([PerioExamNum])
);
GO

CREATE TABLE [periomeasure] (
  [PerioMeasureNum] bigint,
  [PerioExamNum] bigint,
  [SequenceType] tinyint,
  [IntTooth] smallint,
  [ToothValue] smallint,
  [MBvalue] smallint,
  [Bvalue] smallint,
  [DBvalue] smallint,
  [MLvalue] smallint,
  [Lvalue] smallint,
  [DLvalue] smallint,
  [SecDateTEntry] datetime,
  [SecDateTEdit] datetime2,
  PRIMARY KEY ([PerioMeasureNum])
);
GO

CREATE TABLE [pharmclinic] (
  [PharmClinicNum] bigint,
  [PharmacyNum] bigint,
  [ClinicNum] bigint,
  PRIMARY KEY ([PharmClinicNum])
);
GO

CREATE TABLE [phonenumber] (
  [PhoneNumberNum] bigint,
  [PatNum] bigint,
  [PhoneNumberVal] varchar(255),
  [PhoneNumberDigits] varchar(30),
  [PhoneType] tinyint,
  PRIMARY KEY ([PhoneNumberNum])
);
GO

CREATE TABLE [popup] (
  [PopupNum] bigint,
  [PatNum] bigint,
  [Description] varchar(max),
  [IsDisabled] tinyint,
  [PopupLevel] tinyint,
  [UserNum] bigint,
  [DateTimeEntry] datetime,
  [IsArchived] tinyint,
  [PopupNumArchive] bigint,
  [DateTimeDisabled] datetime,
  PRIMARY KEY ([PopupNum])
);
GO

CREATE TABLE [procbuttonitem] (
  [ProcButtonItemNum] bigint,
  [ProcButtonNum] bigint,
  [OldCode] varchar(15),
  [AutoCodeNum] bigint,
  [CodeNum] bigint,
  [ItemOrder] bigint,
  PRIMARY KEY ([ProcButtonItemNum])
);
GO

CREATE TABLE [procbuttonquick] (
  [ProcButtonQuickNum] bigint,
  [Description] varchar(255),
  [CodeValue] varchar(15),
  [Surf] varchar(255),
  [YPos] int,
  [ItemOrder] int,
  [IsLabel] tinyint,
  PRIMARY KEY ([ProcButtonQuickNum])
);
GO

CREATE TABLE [proccodenote] (
  [ProcCodeNoteNum] bigint,
  [CodeNum] bigint,
  [ProvNum] bigint,
  [Note] varchar(max),
  [ProcTime] varchar(255),
  [ProcStatus] tinyint
);
GO

CREATE TABLE [procedurecode] (
  [CodeNum] bigint,
  [ProcCode] varchar(15),
  [Descript] varchar(255),
  [AbbrDesc] varchar(50),
  [ProcTime] varchar(24),
  [ProcCat] bigint,
  [TreatArea] tinyint,
  [NoBillIns] tinyint,
  [IsProsth] tinyint,
  [DefaultNote] varchar(max),
  [IsHygiene] tinyint,
  [GTypeNum] smallint,
  [AlternateCode1] varchar(15),
  [MedicalCode] varchar(15),
  [IsTaxed] tinyint,
  [PaintType] tinyint,
  [GraphicColor] int,
  [LaymanTerm] varchar(255),
  [IsCanadianLab] tinyint,
  [PreExisting] tinyint,
  [BaseUnits] int,
  [SubstitutionCode] varchar(15),
  [SubstOnlyIf] int,
  [DateTStamp] datetime2,
  [IsMultiVisit] tinyint,
  [DrugNDC] varchar(255),
  [RevenueCodeDefault] varchar(255),
  [ProvNumDefault] bigint,
  [CanadaTimeUnits] float,
  [IsRadiology] tinyint,
  [DefaultClaimNote] varchar(max),
  [DefaultTPNote] varchar(max),
  [BypassGlobalLock] tinyint,
  [TaxCode] varchar(16),
  [PaintText] varchar(255),
  [AreaAlsoToothRange] tinyint,
  [DiagnosticCodes] varchar(255),
  PRIMARY KEY ([ProcCode]),
  UNIQUE ([CodeNum])
);
GO

CREATE TABLE [procedurelog] (
  [ProcNum] bigint,
  [PatNum] bigint,
  [AptNum] bigint,
  [OldCode] varchar(15),
  [ProcDate] date,
  [ProcFee] float,
  [Surf] varchar(10),
  [ToothNum] varchar(2),
  [ToothRange] varchar(100),
  [Priority] bigint,
  [ProcStatus] tinyint,
  [ProvNum] bigint,
  [Dx] bigint,
  [PlannedAptNum] bigint,
  [PlaceService] tinyint,
  [Prosthesis] char(1),
  [DateOriginalProsth] date,
  [ClaimNote] varchar(80),
  [DateEntryC] date,
  [ClinicNum] bigint,
  [MedicalCode] varchar(15),
  [DiagnosticCode] varchar(255),
  [IsPrincDiag] tinyint,
  [ProcNumLab] bigint,
  [BillingTypeOne] bigint,
  [BillingTypeTwo] bigint,
  [CodeNum] bigint,
  [CodeMod1] char(2),
  [CodeMod2] char(2),
  [CodeMod3] char(2),
  [CodeMod4] char(2),
  [RevCode] varchar(45),
  [UnitQty] int,
  [BaseUnits] int,
  [StartTime] int,
  [StopTime] int,
  [DateTP] date,
  [SiteNum] bigint,
  [HideGraphics] tinyint,
  [CanadianTypeCodes] varchar(20),
  [ProcTime] time,
  [ProcTimeEnd] time,
  [DateTStamp] datetime2,
  [Prognosis] bigint,
  [DrugUnit] tinyint,
  [DrugQty] float,
  [UnitQtyType] tinyint,
  [StatementNum] bigint,
  [IsLocked] tinyint,
  [BillingNote] varchar(255),
  [RepeatChargeNum] bigint,
  [SnomedBodySite] varchar(255),
  [DiagnosticCode2] varchar(255),
  [DiagnosticCode3] varchar(255),
  [DiagnosticCode4] varchar(255),
  [ProvOrderOverride] bigint,
  [Discount] float,
  [IsDateProsthEst] tinyint,
  [IcdVersion] tinyint,
  [IsCpoe] tinyint,
  [SecUserNumEntry] bigint,
  [SecDateEntry] datetime,
  [DateComplete] date,
  [OrderingReferralNum] bigint,
  [TaxAmt] float,
  [Urgency] tinyint,
  [DiscountPlanAmt] float,
  [NoBillIns] tinyint,
  PRIMARY KEY ([ProcNum])
);
GO

CREATE TABLE [procgroupitem] (
  [ProcGroupItemNum] bigint,
  [ProcNum] bigint,
  [GroupNum] bigint,
  PRIMARY KEY ([ProcGroupItemNum])
);
GO

CREATE TABLE [procmultivisit] (
  [ProcMultiVisitNum] bigint,
  [GroupProcMultiVisitNum] bigint,
  [ProcNum] bigint,
  [ProcStatus] tinyint,
  [IsInProcess] tinyint,
  [SecDateTEntry] datetime,
  [SecDateTEdit] datetime2,
  [PatNum] bigint,
  PRIMARY KEY ([ProcMultiVisitNum])
);
GO

CREATE TABLE [procnote] (
  [ProcNoteNum] bigint,
  [PatNum] bigint,
  [ProcNum] bigint,
  [EntryDateTime] datetime,
  [UserNum] bigint,
  [Note] varchar(max),
  [SigIsTopaz] tinyint,
  [Signature] varchar(max),
  PRIMARY KEY ([ProcNoteNum])
);
GO

CREATE TABLE [proctp] (
  [ProcTPNum] bigint,
  [TreatPlanNum] bigint,
  [PatNum] bigint,
  [ProcNumOrig] bigint,
  [ItemOrder] smallint,
  [Priority] bigint,
  [ToothNumTP] varchar(255),
  [Surf] varchar(255),
  [ProcCode] varchar(15),
  [Descript] varchar(255),
  [FeeAmt] float,
  [PriInsAmt] float,
  [SecInsAmt] float,
  [PatAmt] float,
  [Discount] float,
  [Prognosis] varchar(255),
  [Dx] varchar(255),
  [ProcAbbr] varchar(50),
  [SecUserNumEntry] bigint,
  [SecDateEntry] date,
  [SecDateTEdit] datetime2,
  [FeeAllowed] float,
  [TaxAmt] float,
  [ProvNum] bigint,
  [DateTP] date,
  [ClinicNum] bigint,
  [CatPercUCR] float,
  PRIMARY KEY ([ProcTPNum])
);
GO

CREATE TABLE [programproperty] (
  [ProgramPropertyNum] bigint,
  [ProgramNum] bigint,
  [PropertyDesc] varchar(255),
  [PropertyValue] varchar(max),
  [ComputerName] varchar(255),
  [ClinicNum] bigint,
  [IsMasked] tinyint,
  [IsHighSecurity] tinyint,
  PRIMARY KEY ([ProgramPropertyNum])
);
GO

CREATE TABLE [promotion] (
  [PromotionNum] bigint,
  [PromotionName] varchar(255),
  [DateTimeCreated] date,
  [ClinicNum] bigint,
  [TypePromotion] tinyint,
  PRIMARY KEY ([PromotionNum])
);
GO

CREATE TABLE [promotionlog] (
  [PromotionLogNum] bigint,
  [PromotionNum] bigint,
  [PatNum] bigint,
  [MessageFk] bigint,
  [EmailHostingFK] bigint,
  [DateTimeSent] datetime,
  [PromotionStatus] tinyint,
  [ClinicNum] bigint,
  [SendStatus] tinyint,
  [MessageType] tinyint,
  [DateTimeEntry] datetime,
  [ResponseDescript] varchar(max),
  [ApptReminderRuleNum] bigint,
  PRIMARY KEY ([PromotionLogNum])
);
GO

CREATE TABLE [provider] (
  [ProvNum] bigint,
  [Abbr] varchar(255),
  [ItemOrder] smallint,
  [LName] varchar(100),
  [FName] varchar(100),
  [MI] varchar(100),
  [Suffix] varchar(100),
  [FeeSched] bigint,
  [Specialty] bigint,
  [SSN] varchar(12),
  [StateLicense] varchar(15),
  [DEANum] varchar(15),
  [IsSecondary] tinyint,
  [ProvColor] int,
  [IsHidden] tinyint,
  [UsingTIN] tinyint,
  [BlueCrossID] varchar(25),
  [SigOnFile] tinyint,
  [MedicaidID] varchar(20),
  [OutlineColor] int,
  [SchoolClassNum] bigint,
  [NationalProvID] varchar(255),
  [CanadianOfficeNum] varchar(100),
  [DateTStamp] datetime2,
  [AnesthProvType] bigint,
  [TaxonomyCodeOverride] varchar(255),
  [IsCDAnet] tinyint,
  [EcwID] varchar(255),
  [StateRxID] varchar(255),
  [IsNotPerson] tinyint,
  [StateWhereLicensed] varchar(50),
  [EmailAddressNum] bigint,
  [IsInstructor] tinyint,
  [EhrMuStage] int,
  [ProvNumBillingOverride] bigint,
  [CustomID] varchar(255),
  [ProvStatus] tinyint,
  [IsHiddenReport] tinyint,
  [IsErxEnabled] tinyint,
  [Birthdate] date,
  [SchedNote] varchar(255),
  [WebSchedDescript] varchar(500),
  [WebSchedImageLocation] varchar(255),
  [HourlyProdGoalAmt] float,
  [DateTerm] date,
  [PreferredName] varchar(100),
  PRIMARY KEY ([ProvNum])
);
GO

CREATE TABLE [providerclinic] (
  [ProviderClinicNum] bigint,
  [ProvNum] bigint,
  [ClinicNum] bigint,
  [DEANum] varchar(15),
  [StateLicense] varchar(50),
  [StateRxID] varchar(255),
  [StateWhereLicensed] varchar(15),
  [CareCreditMerchantId] varchar(20),
  PRIMARY KEY ([ProviderClinicNum])
);
GO

CREATE TABLE [providercliniclink] (
  [ProviderClinicLinkNum] bigint,
  [ProvNum] bigint,
  [ClinicNum] bigint,
  PRIMARY KEY ([ProviderClinicLinkNum])
);
GO

CREATE TABLE [providererx] (
  [ProviderErxNum] bigint,
  [PatNum] bigint,
  [NationalProviderID] varchar(255),
  [IsEnabled] tinyint,
  [IsIdentifyProofed] tinyint,
  [IsSentToHq] tinyint,
  [IsEpcs] tinyint,
  [ErxType] tinyint,
  [UserId] varchar(255),
  [AccountId] varchar(25),
  [RegistrationKeyNum] bigint,
  PRIMARY KEY ([ProviderErxNum])
);
GO

CREATE TABLE [providerident] (
  [ProviderIdentNum] bigint,
  [ProvNum] bigint,
  [PayorID] varchar(255),
  [SuppIDType] tinyint,
  [IDNumber] varchar(255),
  PRIMARY KEY ([ProviderIdentNum])
);
GO

CREATE TABLE [question] (
  [QuestionNum] bigint,
  [PatNum] bigint,
  [ItemOrder] smallint,
  [Description] varchar(max),
  [Answer] varchar(max),
  [FormPatNum] bigint,
  PRIMARY KEY ([QuestionNum])
);
GO

CREATE TABLE [reactivation] (
  [ReactivationNum] bigint,
  [PatNum] bigint,
  [ReactivationStatus] bigint,
  [ReactivationNote] varchar(max),
  [DoNotContact] tinyint,
  PRIMARY KEY ([ReactivationNum])
);
GO

CREATE TABLE [recall] (
  [RecallNum] bigint,
  [PatNum] bigint,
  [DateDueCalc] date,
  [DateDue] date,
  [DatePrevious] date,
  [RecallInterval] int,
  [RecallStatus] bigint,
  [Note] varchar(max),
  [IsDisabled] tinyint,
  [DateTStamp] datetime2,
  [RecallTypeNum] bigint,
  [DisableUntilBalance] float,
  [DisableUntilDate] date,
  [DateScheduled] date,
  [Priority] tinyint,
  [TimePatternOverride] varchar(255),
  PRIMARY KEY ([RecallNum])
);
GO

CREATE TABLE [recalltrigger] (
  [RecallTriggerNum] bigint,
  [RecallTypeNum] bigint,
  [CodeNum] bigint,
  PRIMARY KEY ([RecallTriggerNum])
);
GO

CREATE TABLE [recurringcharge] (
  [RecurringChargeNum] bigint,
  [PatNum] bigint,
  [ClinicNum] bigint,
  [DateTimeCharge] datetime,
  [ChargeStatus] tinyint,
  [FamBal] float,
  [PayPlanDue] float,
  [TotalDue] float,
  [RepeatAmt] float,
  [ChargeAmt] float,
  [UserNum] bigint,
  [PayNum] bigint,
  [CreditCardNum] bigint,
  [ErrorMsg] varchar(max),
  PRIMARY KEY ([RecurringChargeNum])
);
GO

CREATE TABLE [refattach] (
  [RefAttachNum] bigint,
  [ReferralNum] bigint,
  [PatNum] bigint,
  [ItemOrder] smallint,
  [RefDate] date,
  [RefType] tinyint,
  [RefToStatus] tinyint,
  [Note] varchar(max),
  [IsTransitionOfCare] tinyint,
  [ProcNum] bigint,
  [DateProcComplete] date,
  [ProvNum] bigint,
  [DateTStamp] datetime2,
  PRIMARY KEY ([RefAttachNum])
);
GO

CREATE TABLE [referral] (
  [ReferralNum] bigint,
  [LName] varchar(100),
  [FName] varchar(100),
  [MName] varchar(100),
  [SSN] varchar(9),
  [UsingTIN] tinyint,
  [Specialty] bigint,
  [ST] varchar(2),
  [Telephone] varchar(30),
  [Address] varchar(100),
  [Address2] varchar(100),
  [City] varchar(100),
  [Zip] varchar(10),
  [Note] varchar(max),
  [Phone2] varchar(30),
  [IsHidden] tinyint,
  [NotPerson] tinyint,
  [Title] varchar(255),
  [EMail] varchar(255),
  [PatNum] bigint,
  [NationalProvID] varchar(255),
  [Slip] bigint,
  [IsDoctor] tinyint,
  [IsTrustedDirect] tinyint,
  [DateTStamp] datetime2,
  [IsPreferred] tinyint,
  [BusinessName] varchar(255),
  [DisplayNote] varchar(4000),
  PRIMARY KEY ([ReferralNum])
);
GO

CREATE TABLE [referralcliniclink] (
  [ReferralClinicLinkNum] bigint,
  [ReferralNum] bigint,
  [ClinicNum] bigint,
  PRIMARY KEY ([ReferralClinicLinkNum])
);
GO

CREATE TABLE [registrationkey] (
  [RegistrationKeyNum] bigint,
  [PatNum] bigint,
  [RegKey] varchar(4000),
  [Note] varchar(4000),
  [DateStarted] date,
  [DateDisabled] date,
  [DateEnded] date,
  [IsForeign] tinyint,
  [UsesServerVersion] tinyint,
  [IsFreeVersion] tinyint,
  [IsOnlyForTesting] tinyint,
  [VotesAllotted] int,
  [IsResellerCustomer] tinyint,
  [HasEarlyAccess] tinyint,
  [DateTBackupScheduled] datetime,
  [BackupPassCode] varchar(32),
  [DateTClinicAccess] datetime,
  PRIMARY KEY ([RegistrationKeyNum])
);
GO

CREATE TABLE [repeatcharge] (
  [RepeatChargeNum] bigint,
  [PatNum] bigint,
  [ProcCode] varchar(15),
  [ChargeAmt] float,
  [DateStart] date,
  [DateStop] date,
  [Note] varchar(max),
  [CopyNoteToProc] tinyint,
  [CreatesClaim] tinyint,
  [IsEnabled] tinyint,
  [UsePrepay] tinyint,
  [Npi] varchar(max),
  [ErxAccountId] varchar(max),
  [ProviderName] varchar(max),
  [ChargeAmtAlt] float,
  [UnearnedTypes] varchar(4000),
  [Frequency] tinyint,
  PRIMARY KEY ([RepeatChargeNum])
);
GO

CREATE TABLE [reqstudent] (
  [ReqStudentNum] bigint,
  [ReqNeededNum] bigint,
  [Descript] varchar(255),
  [SchoolCourseNum] bigint,
  [ProvNum] bigint,
  [AptNum] bigint,
  [PatNum] bigint,
  [InstructorNum] bigint,
  [DateCompleted] date,
  [ProcNum] bigint,
  PRIMARY KEY ([ReqStudentNum])
);
GO

CREATE TABLE [rxpat] (
  [RxNum] bigint,
  [PatNum] bigint,
  [RxDate] date,
  [Drug] varchar(255),
  [Sig] varchar(255),
  [Disp] varchar(255),
  [Refills] varchar(30),
  [ProvNum] bigint,
  [Notes] varchar(255),
  [PharmacyNum] bigint,
  [IsControlled] tinyint,
  [DateTStamp] datetime2,
  [SendStatus] tinyint,
  [RxCui] bigint,
  [DosageCode] varchar(255),
  [ErxGuid] varchar(40),
  [IsErxOld] tinyint,
  [ErxPharmacyInfo] varchar(255),
  [IsProcRequired] tinyint,
  [ProcNum] bigint,
  [DaysOfSupply] float,
  [PatientInstruction] varchar(max),
  [ClinicNum] bigint,
  [UserNum] bigint,
  [RxType] tinyint,
  PRIMARY KEY ([RxNum])
);
GO

CREATE TABLE [schedule] (
  [ScheduleNum] bigint,
  [SchedDate] date,
  [StartTime] time,
  [StopTime] time,
  [SchedType] tinyint,
  [ProvNum] bigint,
  [BlockoutType] bigint,
  [Note] varchar(max),
  [Status] tinyint,
  [EmployeeNum] bigint,
  [DateTStamp] datetime2,
  [ClinicNum] bigint,
  PRIMARY KEY ([ScheduleNum])
);
GO

CREATE TABLE [scheduleop] (
  [ScheduleOpNum] bigint,
  [ScheduleNum] bigint,
  [OperatoryNum] bigint,
  PRIMARY KEY ([ScheduleOpNum])
);
GO

CREATE TABLE [schoolapproval] (
  [SchoolApprovalNum] bigint,
  [ProvNum] bigint,
  [SignOffStatus] tinyint,
  [InstructorNum] bigint,
  [AptNum] bigint,
  [ProcNum] bigint,
  [TreatPlanNum] bigint,
  [PerioExamNum] bigint,
  [AllergyNum] bigint,
  [DiseaseNum] bigint,
  [DocNum] bigint,
  [MountNum] bigint,
  [SecDateEntry] date,
  [SecDateTEdit] datetime2,
  PRIMARY KEY ([SchoolApprovalNum])
);
GO

CREATE TABLE [schoolcourseenrollee] (
  [SchoolCourseEnrolleeNum] bigint,
  [SchoolCourseNum] bigint,
  [StudentNum] bigint,
  [GradeNumber] float,
  [GradeOverride] float,
  PRIMARY KEY ([SchoolCourseEnrolleeNum])
);
GO

CREATE TABLE [schoolcourseinstructor] (
  [SchoolCourseInstructorNum] bigint,
  [SchoolCourseNum] bigint,
  [InstructorNum] bigint,
  PRIMARY KEY ([SchoolCourseInstructorNum])
);
GO

CREATE TABLE [screen] (
  [ScreenNum] bigint,
  [Gender] tinyint,
  [RaceOld] tinyint,
  [GradeLevel] tinyint,
  [Age] tinyint,
  [Urgency] tinyint,
  [HasCaries] tinyint,
  [NeedsSealants] tinyint,
  [CariesExperience] tinyint,
  [EarlyChildCaries] tinyint,
  [ExistingSealants] tinyint,
  [MissingAllTeeth] tinyint,
  [Birthdate] date,
  [ScreenGroupNum] bigint,
  [ScreenGroupOrder] smallint,
  [Comments] varchar(255),
  [ScreenPatNum] bigint,
  [SheetNum] bigint,
  PRIMARY KEY ([ScreenNum])
);
GO

CREATE TABLE [screengroup] (
  [ScreenGroupNum] bigint,
  [Description] varchar(255),
  [SGDate] date,
  [ProvName] varchar(255),
  [ProvNum] bigint,
  [PlaceService] tinyint,
  [County] varchar(255),
  [GradeSchool] varchar(255),
  [SheetDefNum] bigint,
  PRIMARY KEY ([ScreenGroupNum])
);
GO

CREATE TABLE [screenpat] (
  [ScreenPatNum] bigint,
  [PatNum] bigint,
  [ScreenGroupNum] bigint,
  [SheetNum] bigint,
  [PatScreenPerm] tinyint,
  PRIMARY KEY ([ScreenPatNum])
);
GO

CREATE TABLE [securitylog] (
  [SecurityLogNum] bigint,
  [PermType] smallint,
  [UserNum] bigint,
  [LogDateTime] datetime,
  [LogText] varchar(max),
  [PatNum] bigint,
  [CompName] varchar(255),
  [FKey] bigint,
  [LogSource] tinyint,
  [DefNum] bigint,
  [DefNumError] bigint,
  [DateTPrevious] datetime,
  PRIMARY KEY ([SecurityLogNum])
);
GO

CREATE TABLE [securityloghash] (
  [SecurityLogHashNum] bigint,
  [SecurityLogNum] bigint,
  [LogHash] varchar(255),
  PRIMARY KEY ([SecurityLogHashNum])
);
GO

CREATE TABLE [sheet] (
  [SheetNum] bigint,
  [SheetType] int,
  [PatNum] bigint,
  [DateTimeSheet] datetime,
  [FontSize] float,
  [FontName] varchar(255),
  [Width] int,
  [Height] int,
  [IsLandscape] tinyint,
  [InternalNote] varchar(max),
  [Description] varchar(255),
  [ShowInTerminal] tinyint,
  [IsWebForm] tinyint,
  [IsMultiPage] tinyint,
  [IsDeleted] tinyint,
  [SheetDefNum] bigint,
  [DocNum] bigint,
  [ClinicNum] bigint,
  [DateTSheetEdited] datetime,
  [HasMobileLayout] tinyint,
  [RevID] int,
  [WebFormSheetID] bigint,
  PRIMARY KEY ([SheetNum])
);
GO

CREATE TABLE [sheetfield] (
  [SheetFieldNum] bigint,
  [SheetNum] bigint,
  [FieldType] int,
  [FieldName] varchar(255),
  [FieldValue] varchar(max),
  [FontSize] float,
  [FontName] varchar(255),
  [FontIsBold] tinyint,
  [XPos] int,
  [YPos] int,
  [Width] int,
  [Height] int,
  [GrowthBehavior] int,
  [RadioButtonValue] varchar(255),
  [RadioButtonGroup] varchar(255),
  [IsRequired] tinyint,
  [TabOrder] int,
  [ReportableName] varchar(255),
  [TextAlign] tinyint,
  [ItemColor] int,
  [DateTimeSig] datetime,
  [IsLocked] tinyint,
  [TabOrderMobile] int,
  [UiLabelMobile] varchar(max),
  [UiLabelMobileRadioButton] varchar(max),
  [SheetFieldDefNum] bigint,
  [CanElectronicallySign] tinyint,
  [IsSigProvRestricted] tinyint,
  [UserSigned] bigint,
  PRIMARY KEY ([SheetFieldNum])
);
GO

CREATE TABLE [site] (
  [SiteNum] bigint,
  [Description] varchar(255),
  [Note] varchar(max),
  [Address] varchar(100),
  [Address2] varchar(100),
  [City] varchar(100),
  [State] varchar(100),
  [Zip] varchar(100),
  [ProvNum] bigint,
  [PlaceService] tinyint,
  PRIMARY KEY ([SiteNum]),
  UNIQUE ([Description])
);
GO

CREATE TABLE [smsfrommobile] (
  [SmsFromMobileNum] bigint,
  [PatNum] bigint,
  [ClinicNum] bigint,
  [CommlogNum] bigint,
  [MsgText] varchar(max),
  [DateTimeReceived] datetime,
  [SmsPhoneNumber] varchar(255),
  [MobilePhoneNumber] varchar(255),
  [MsgPart] int,
  [MsgTotal] int,
  [MsgRefID] varchar(255),
  [SmsStatus] tinyint,
  [Flags] varchar(255),
  [IsHidden] tinyint,
  [MatchCount] int,
  [GuidMessage] varchar(255),
  [SecDateTEdit] datetime2,
  PRIMARY KEY ([SmsFromMobileNum]),
  UNIQUE ([GuidMessage])
);
GO

CREATE TABLE [smsphone] (
  [SmsPhoneNum] bigint,
  [ClinicNum] bigint,
  [PhoneNumber] varchar(255),
  [DateTimeActive] datetime,
  [DateTimeInactive] datetime,
  [InactiveCode] varchar(255),
  [CountryCode] varchar(255),
  PRIMARY KEY ([SmsPhoneNum])
);
GO

CREATE TABLE [smstomobile] (
  [SmsToMobileNum] bigint,
  [PatNum] bigint,
  [GuidMessage] varchar(255),
  [GuidBatch] varchar(255),
  [SmsPhoneNumber] varchar(255),
  [MobilePhoneNumber] varchar(255),
  [IsTimeSensitive] tinyint,
  [MsgType] tinyint,
  [MsgText] varchar(max),
  [SmsStatus] tinyint,
  [MsgParts] int,
  [MsgChargeUSD] float,
  [ClinicNum] bigint,
  [CustErrorText] varchar(255),
  [DateTimeSent] datetime,
  [DateTimeTerminated] datetime,
  [IsHidden] tinyint,
  [MsgDiscountUSD] float,
  [SecDateTEdit] datetime2,
  PRIMARY KEY ([SmsToMobileNum]),
  UNIQUE ([GuidMessage])
);
GO

CREATE TABLE [statement] (
  [StatementNum] bigint,
  [PatNum] bigint,
  [DateSent] date,
  [DateRangeFrom] date,
  [DateRangeTo] date,
  [Note] varchar(max),
  [NoteBold] varchar(max),
  [Mode_] tinyint,
  [HidePayment] tinyint,
  [SinglePatient] tinyint,
  [Intermingled] tinyint,
  [IsSent] tinyint,
  [DocNum] bigint,
  [DateTStamp] datetime2,
  [IsReceipt] tinyint,
  [IsInvoice] tinyint,
  [IsInvoiceCopy] tinyint,
  [EmailSubject] varchar(255),
  [EmailBody] varchar(max),
  [SuperFamily] bigint,
  [IsBalValid] tinyint,
  [InsEst] float,
  [BalTotal] float,
  [StatementType] varchar(50),
  [ShortGUID] varchar(30),
  [StatementShortURL] varchar(50),
  [StatementURL] varchar(255),
  [SmsSendStatus] tinyint,
  [LimitedCustomFamily] tinyint,
  [ShowTransSinceBalZero] tinyint,
  PRIMARY KEY ([StatementNum])
);
GO

CREATE TABLE [statementprod] (
  [StatementProdNum] bigint,
  [StatementNum] bigint,
  [FKey] bigint,
  [ProdType] tinyint,
  [LateChargeAdjNum] bigint,
  [DocNum] bigint,
  PRIMARY KEY ([StatementProdNum])
);
GO

CREATE TABLE [stmtlink] (
  [StmtLinkNum] bigint,
  [StatementNum] bigint,
  [StmtLinkType] tinyint,
  [FKey] bigint,
  PRIMARY KEY ([StmtLinkNum])
);
GO

CREATE TABLE [substitutionlink] (
  [SubstitutionLinkNum] bigint,
  [PlanNum] bigint,
  [CodeNum] bigint,
  [SubstitutionCode] varchar(15),
  [SubstOnlyIf] int,
  PRIMARY KEY ([SubstitutionLinkNum])
);
GO

CREATE TABLE [supplyorder] (
  [SupplyOrderNum] bigint,
  [SupplierNum] bigint,
  [DatePlaced] date,
  [Note] varchar(max),
  [AmountTotal] float,
  [UserNum] bigint,
  [ShippingCharge] float,
  [DateReceived] date,
  PRIMARY KEY ([SupplyOrderNum])
);
GO

CREATE TABLE [supplyorderitem] (
  [SupplyOrderItemNum] bigint,
  [SupplyOrderNum] bigint,
  [SupplyNum] bigint,
  [Qty] int,
  [Price] float,
  [DateReceived] date,
  PRIMARY KEY ([SupplyOrderItemNum])
);
GO

CREATE TABLE [task] (
  [TaskNum] bigint,
  [TaskListNum] bigint,
  [DateTask] date,
  [KeyNum] bigint,
  [Descript] varchar(max),
  [TaskStatus] tinyint,
  [IsRepeating] tinyint,
  [DateType] tinyint,
  [FromNum] bigint,
  [ObjectType] tinyint,
  [DateTimeEntry] datetime,
  [UserNum] bigint,
  [DateTimeFinished] datetime,
  [PriorityDefNum] bigint,
  [ReminderGroupId] varchar(20),
  [ReminderType] smallint,
  [ReminderFrequency] int,
  [DateTimeOriginal] datetime,
  [SecDateTEdit] datetime2,
  [DescriptOverride] varchar(255),
  [IsReadOnly] tinyint,
  [Category] bigint,
  [TriagePosition] int,
  PRIMARY KEY ([TaskNum])
);
GO

CREATE TABLE [taskancestor] (
  [TaskAncestorNum] bigint,
  [TaskNum] bigint,
  [TaskListNum] bigint,
  PRIMARY KEY ([TaskAncestorNum])
);
GO

CREATE TABLE [taskattachment] (
  [TaskAttachmentNum] bigint,
  [TaskNum] bigint,
  [DocNum] bigint,
  [TextValue] varchar(max),
  [Description] varchar(255),
  PRIMARY KEY ([TaskAttachmentNum])
);
GO

CREATE TABLE [taskhist] (
  [TaskHistNum] bigint,
  [UserNumHist] bigint,
  [DateTStamp] datetime,
  [IsNoteChange] tinyint,
  [TaskNum] bigint,
  [TaskListNum] bigint,
  [DateTask] date,
  [KeyNum] bigint,
  [Descript] varchar(max),
  [TaskStatus] tinyint,
  [IsRepeating] tinyint,
  [DateType] tinyint,
  [FromNum] bigint,
  [ObjectType] tinyint,
  [DateTimeEntry] datetime,
  [UserNum] bigint,
  [DateTimeFinished] datetime,
  [PriorityDefNum] bigint,
  [ReminderGroupId] varchar(20),
  [ReminderType] smallint,
  [ReminderFrequency] int,
  [DateTimeOriginal] datetime,
  [SecDateTEdit] datetime2,
  [DescriptOverride] varchar(255),
  [IsReadOnly] tinyint,
  [Category] bigint,
  [TriagePosition] int,
  PRIMARY KEY ([TaskHistNum])
);
GO

CREATE TABLE [tasknote] (
  [TaskNoteNum] bigint,
  [TaskNum] bigint,
  [UserNum] bigint,
  [DateTimeNote] datetime,
  [Note] varchar(max),
  PRIMARY KEY ([TaskNoteNum])
);
GO

CREATE TABLE [tasksubscription] (
  [TaskSubscriptionNum] bigint,
  [UserNum] bigint,
  [TaskListNum] bigint,
  [TaskNum] bigint,
  PRIMARY KEY ([TaskSubscriptionNum])
);
GO

CREATE TABLE [taskunread] (
  [TaskUnreadNum] bigint,
  [TaskNum] bigint,
  [UserNum] bigint,
  PRIMARY KEY ([TaskUnreadNum])
);
GO

CREATE TABLE [terminalactive] (
  [TerminalActiveNum] bigint,
  [ComputerName] varchar(255),
  [TerminalStatus] tinyint,
  [PatNum] bigint,
  [SessionId] int,
  [ProcessId] int,
  [SessionName] varchar(255),
  PRIMARY KEY ([TerminalActiveNum])
);
GO

CREATE TABLE [timeadjust] (
  [TimeAdjustNum] bigint,
  [EmployeeNum] bigint,
  [TimeEntry] datetime,
  [RegHours] time,
  [OTimeHours] time,
  [Note] varchar(max),
  [IsAuto] tinyint,
  [ClinicNum] bigint,
  [PtoDefNum] bigint,
  [PtoHours] time,
  [IsUnpaidProtectedLeave] tinyint,
  [SecuUserNumEntry] bigint,
  PRIMARY KEY ([TimeAdjustNum])
);
GO

CREATE TABLE [toothgridcell] (
  [ToothGridCellNum] bigint,
  [SheetFieldNum] bigint,
  [ToothGridColNum] bigint,
  [ValueEntered] varchar(255),
  [ToothNum] varchar(10),
  PRIMARY KEY ([ToothGridCellNum])
);
GO

CREATE TABLE [toothgridcol] (
  [ToothGridColNum] bigint,
  [SheetFieldNum] bigint,
  [NameItem] varchar(255),
  [CellType] tinyint,
  [ItemOrder] smallint,
  [ColumnWidth] smallint,
  [CodeNum] bigint,
  [ProcStatus] tinyint,
  PRIMARY KEY ([ToothGridColNum])
);
GO

CREATE TABLE [toothgriddef] (
  [ToothGridDefNum] bigint,
  [NameInternal] varchar(255),
  [NameShowing] varchar(255),
  [CellType] tinyint,
  [ItemOrder] smallint,
  [ColumnWidth] smallint,
  [CodeNum] bigint,
  [ProcStatus] tinyint,
  [SheetFieldDefNum] bigint,
  PRIMARY KEY ([ToothGridDefNum])
);
GO

CREATE TABLE [toothinitial] (
  [ToothInitialNum] bigint,
  [PatNum] bigint,
  [ToothNum] varchar(2),
  [InitialType] tinyint,
  [Movement] float,
  [DrawingSegment] varchar(max),
  [ColorDraw] int,
  [SecDateTEntry] datetime,
  [SecDateTEdit] datetime2,
  [DrawText] varchar(255),
  PRIMARY KEY ([ToothInitialNum])
);
GO

CREATE TABLE [transaction] (
  [TransactionNum] bigint,
  [DateTimeEntry] datetime,
  [UserNum] bigint,
  [DepositNum] bigint,
  [PayNum] bigint,
  [SecUserNumEdit] bigint,
  [SecDateTEdit] datetime2,
  [TransactionInvoiceNum] bigint,
  [NeedsReview] tinyint,
  PRIMARY KEY ([TransactionNum])
);
GO

CREATE TABLE [treatplan] (
  [TreatPlanNum] bigint,
  [PatNum] bigint,
  [DateTP] date,
  [Heading] varchar(255),
  [Note] varchar(max),
  [Signature] varchar(max),
  [SigIsTopaz] tinyint,
  [ResponsParty] bigint,
  [DocNum] bigint,
  [TPStatus] tinyint,
  [SecUserNumEntry] bigint,
  [SecDateEntry] date,
  [SecDateTEdit] datetime2,
  [UserNumPresenter] bigint,
  [TPType] tinyint,
  [SignaturePractice] varchar(max),
  [DateTSigned] datetime,
  [DateTPracticeSigned] datetime,
  [SignatureText] varchar(255),
  [SignaturePracticeText] varchar(255),
  [MobileAppDeviceNum] bigint,
  PRIMARY KEY ([TreatPlanNum])
);
GO

CREATE TABLE [treatplanattach] (
  [TreatPlanAttachNum] bigint,
  [TreatPlanNum] bigint,
  [ProcNum] bigint,
  [Priority] bigint,
  PRIMARY KEY ([TreatPlanAttachNum])
);
GO

CREATE TABLE [treatplanparam] (
  [TreatPlanParamNum] bigint,
  [PatNum] bigint,
  [TreatPlanNum] bigint,
  [ShowDiscount] tinyint,
  [ShowMaxDed] tinyint,
  [ShowSubTotals] tinyint,
  [ShowTotals] tinyint,
  [ShowCompleted] tinyint,
  [ShowFees] tinyint,
  [ShowIns] tinyint
);
GO

CREATE TABLE [tsitranslog] (
  [TsiTransLogNum] bigint,
  [PatNum] bigint,
  [UserNum] bigint,
  [TransType] tinyint,
  [TransDateTime] datetime,
  [ServiceType] tinyint,
  [ServiceCode] tinyint,
  [TransAmt] float,
  [AccountBalance] float,
  [FKeyType] tinyint,
  [FKey] bigint,
  [RawMsgText] varchar(1000),
  [ClientId] varchar(25),
  [TransJson] varchar(max),
  [ClinicNum] bigint,
  [AggTransLogNum] bigint,
  PRIMARY KEY ([TsiTransLogNum])
);
GO

CREATE TABLE [userclinic] (
  [UserClinicNum] bigint,
  [UserNum] bigint,
  [ClinicNum] bigint,
  PRIMARY KEY ([UserClinicNum])
);
GO

CREATE TABLE [usergroupattach] (
  [UserGroupAttachNum] bigint,
  [UserNum] bigint,
  [UserGroupNum] bigint,
  PRIMARY KEY ([UserGroupAttachNum])
);
GO

CREATE TABLE [userod] (
  [UserNum] bigint,
  [UserName] varchar(255),
  [Password] varchar(255),
  [UserGroupNum] bigint,
  [EmployeeNum] bigint,
  [ClinicNum] bigint,
  [ProvNum] bigint,
  [IsHidden] tinyint,
  [TaskListInBox] bigint,
  [AnesthProvType] int,
  [DefaultHidePopups] tinyint,
  [PasswordIsStrong] tinyint,
  [ClinicIsRestricted] tinyint,
  [InboxHidePopups] tinyint,
  [UserNumCEMT] bigint,
  [DateTFail] datetime,
  [FailedAttempts] tinyint,
  [DomainUser] varchar(255),
  [IsPasswordResetRequired] tinyint,
  [MobileWebPin] varchar(255),
  [MobileWebPinFailedAttempts] tinyint,
  [DateTLastLogin] datetime,
  [EClipboardClinicalPin] varchar(128),
  [BadgeId] varchar(255),
  PRIMARY KEY ([UserNum])
);
GO

CREATE TABLE [userodapptview] (
  [UserodApptViewNum] bigint,
  [UserNum] bigint,
  [ClinicNum] bigint,
  [ApptViewNum] bigint,
  PRIMARY KEY ([UserodApptViewNum])
);
GO

CREATE TABLE [userodpref] (
  [UserOdPrefNum] bigint,
  [UserNum] bigint,
  [Fkey] bigint,
  [FkeyType] tinyint,
  [ValueString] varchar(max),
  [ClinicNum] bigint,
  PRIMARY KEY ([UserOdPrefNum])
);
GO

CREATE TABLE [vaccineobs] (
  [VaccineObsNum] bigint,
  [VaccinePatNum] bigint,
  [ValType] tinyint,
  [IdentifyingCode] tinyint,
  [ValReported] varchar(255),
  [ValCodeSystem] tinyint,
  [VaccineObsNumGroup] bigint,
  [UcumCode] varchar(255),
  [DateObs] date,
  [MethodCode] varchar(255),
  PRIMARY KEY ([VaccineObsNum])
);
GO

CREATE TABLE [vaccinepat] (
  [VaccinePatNum] bigint,
  [VaccineDefNum] bigint,
  [DateTimeStart] datetime,
  [DateTimeEnd] datetime,
  [AdministeredAmt] float,
  [DrugUnitNum] bigint,
  [LotNumber] varchar(255),
  [PatNum] bigint,
  [Note] varchar(max),
  [FilledCity] varchar(255),
  [FilledST] varchar(255),
  [CompletionStatus] tinyint,
  [AdministrationNoteCode] tinyint,
  [UserNum] bigint,
  [ProvNumOrdering] bigint,
  [ProvNumAdminister] bigint,
  [DateExpire] date,
  [RefusalReason] tinyint,
  [ActionCode] tinyint,
  [AdministrationRoute] tinyint,
  [AdministrationSite] tinyint,
  PRIMARY KEY ([VaccinePatNum])
);
GO

CREATE TABLE [vitalsign] (
  [VitalsignNum] bigint,
  [PatNum] bigint,
  [Height] float,
  [Weight] float,
  [BpSystolic] smallint,
  [BpDiastolic] smallint,
  [DateTaken] date,
  [HasFollowupPlan] tinyint,
  [IsIneligible] tinyint,
  [Documentation] varchar(max),
  [ChildGotNutrition] tinyint,
  [ChildGotPhysCouns] tinyint,
  [WeightCode] varchar(255),
  [HeightExamCode] varchar(30),
  [WeightExamCode] varchar(30),
  [BMIExamCode] varchar(30),
  [EhrNotPerformedNum] bigint,
  [PregDiseaseNum] bigint,
  [BMIPercentile] int,
  [Pulse] int,
  PRIMARY KEY ([VitalsignNum])
);
GO

CREATE TABLE [webschedcarrierrule] (
  [WebSchedCarrierRuleNum] bigint,
  [ClinicNum] bigint,
  [CarrierName] varchar(255),
  [DisplayName] varchar(255),
  [Message] varchar(max),
  [Rule] tinyint,
  PRIMARY KEY ([WebSchedCarrierRuleNum])
);
GO

CREATE TABLE [webschedrecall] (
  [WebSchedRecallNum] bigint,
  [ClinicNum] bigint,
  [PatNum] bigint,
  [RecallNum] bigint,
  [DateTimeEntry] datetime,
  [DateDue] datetime,
  [ReminderCount] int,
  [DateTimeSent] datetime,
  [DateTimeSendFailed] datetime,
  [SendStatus] tinyint,
  [ShortGUID] varchar(255),
  [ResponseDescript] varchar(max),
  [Source] tinyint,
  [CommlogNum] bigint,
  [MessageType] tinyint,
  [MessageFk] bigint,
  [ApptReminderRuleNum] bigint
);
GO

CREATE TABLE [wikilisthist] (
  [WikiListHistNum] bigint,
  [UserNum] bigint,
  [ListName] varchar(255),
  [ListHeaders] varchar(max),
  [ListContent] varchar(max),
  [DateTimeSaved] datetime,
  PRIMARY KEY ([WikiListHistNum])
);
GO

CREATE TABLE [wikipage] (
  [WikiPageNum] bigint,
  [UserNum] bigint,
  [PageTitle] varchar(255),
  [KeyWords] varchar(255),
  [PageContent] varchar(max),
  [DateTimeSaved] datetime,
  [IsDraft] tinyint,
  [IsLocked] tinyint,
  [IsDeleted] tinyint,
  [PageContentPlainText] varchar(max),
  PRIMARY KEY ([WikiPageNum])
);
GO

CREATE TABLE [wikipagehist] (
  [WikiPageNum] bigint,
  [UserNum] bigint,
  [PageTitle] varchar(255),
  [PageContent] varchar(max),
  [DateTimeSaved] datetime,
  [IsDeleted] tinyint,
  PRIMARY KEY ([WikiPageNum])
);
GO

CREATE TABLE [xchargetransaction] (
  [XChargeTransactionNum] bigint,
  [TransType] varchar(255),
  [Amount] float,
  [CCEntry] varchar(255),
  [PatNum] bigint,
  [Result] varchar(255),
  [ClerkID] varchar(255),
  [ResultCode] varchar(255),
  [Expiration] varchar(255),
  [CCType] varchar(255),
  [CreditCardNum] varchar(255),
  [BatchNum] varchar(255),
  [ItemNum] varchar(255),
  [ApprCode] varchar(255),
  [TransactionDateTime] datetime,
  [BatchTotal] float,
  PRIMARY KEY ([XChargeTransactionNum])
);
GO

CREATE TABLE [xwebresponse] (
  [XWebResponseNum] bigint,
  [PatNum] bigint,
  [ProvNum] bigint,
  [ClinicNum] bigint,
  [PaymentNum] bigint,
  [DateTEntry] datetime,
  [DateTUpdate] datetime,
  [TransactionStatus] tinyint,
  [ResponseCode] int,
  [XWebResponseCode] varchar(255),
  [ResponseDescription] varchar(255),
  [OTK] varchar(255),
  [HpfUrl] varchar(max),
  [HpfExpiration] datetime,
  [TransactionID] varchar(255),
  [TransactionType] varchar(255),
  [Alias] varchar(255),
  [CardType] varchar(255),
  [CardBrand] varchar(255),
  [CardBrandShort] varchar(255),
  [MaskedAcctNum] varchar(255),
  [Amount] float,
  [ApprovalCode] varchar(255),
  [CardCodeResponse] varchar(255),
  [ReceiptID] int,
  [ExpDate] varchar(255),
  [EntryMethod] varchar(255),
  [ProcessorResponse] varchar(255),
  [BatchNum] int,
  [BatchAmount] float,
  [AccountExpirationDate] date,
  [DebugError] varchar(max),
  [PayNote] varchar(max),
  [CCSource] tinyint,
  [OrderId] varchar(255),
  [EmailResponse] varchar(255),
  [LogGuid] varchar(36),
  PRIMARY KEY ([XWebResponseNum])
);
GO

-- OpenDental schema (foreign keys, best-effort from documentation XML)

ALTER TABLE [employee] ADD CONSTRAINT [fk_employee_1_ReportsTo] FOREIGN KEY ([ReportsTo]) REFERENCES [employee] ([EmployeeNum]);
GO

ALTER TABLE [hl7deffield] ADD CONSTRAINT [fk_hl7deffield_1_HL7DefSegmentNum] FOREIGN KEY ([HL7DefSegmentNum]) REFERENCES [hl7defsegment] ([HL7DefSegmentNum]);
GO

ALTER TABLE [medication] ADD CONSTRAINT [fk_medication_1_GenericNum] FOREIGN KEY ([GenericNum]) REFERENCES [medication] ([MedicationNum]);
GO

ALTER TABLE [orthocharttab] ADD CONSTRAINT [fk_orthocharttab_1_OrthoChartTabNum] FOREIGN KEY ([OrthoChartTabNum]) REFERENCES [orthocharttab] ([OrthoChartTabNum]);
GO

ALTER TABLE [tasklist] ADD CONSTRAINT [fk_tasklist_1_Parent] FOREIGN KEY ([Parent]) REFERENCES [tasklist] ([TaskListNum]);
GO

ALTER TABLE [tasklist] ADD CONSTRAINT [fk_tasklist_2_FromNum] FOREIGN KEY ([FromNum]) REFERENCES [tasklist] ([TaskListNum]);
GO

ALTER TABLE [usergroup] ADD CONSTRAINT [fk_usergroup_1_UserGroupNumCEMT] FOREIGN KEY ([UserGroupNumCEMT]) REFERENCES [usergroup] ([UserGroupNum]);
GO

ALTER TABLE [reconcile] ADD CONSTRAINT [fk_reconcile_1_AccountNum] FOREIGN KEY ([AccountNum]) REFERENCES [account] ([AccountNum]);
GO

ALTER TABLE [alertcategorylink] ADD CONSTRAINT [fk_alertcategorylink_1_AlertCategoryNum] FOREIGN KEY ([AlertCategoryNum]) REFERENCES [alertcategory] ([AlertCategoryNum]);
GO

ALTER TABLE [displayfield] ADD CONSTRAINT [fk_displayfield_1_ChartViewNum] FOREIGN KEY ([ChartViewNum]) REFERENCES [chartview] ([ChartViewNum]);
GO

ALTER TABLE [claimformitem] ADD CONSTRAINT [fk_claimformitem_1_ClaimFormNum] FOREIGN KEY ([ClaimFormNum]) REFERENCES [claimform] ([ClaimFormNum]);
GO

ALTER TABLE [printer] ADD CONSTRAINT [fk_printer_1_ComputerNum] FOREIGN KEY ([ComputerNum]) REFERENCES [computer] ([ComputerNum]);
GO

ALTER TABLE [conngroupattach] ADD CONSTRAINT [fk_conngroupattach_1_ConnectionGroupNum] FOREIGN KEY ([ConnectionGroupNum]) REFERENCES [connectiongroup] ([ConnectionGroupNum]);
GO

ALTER TABLE [conngroupattach] ADD CONSTRAINT [fk_conngroupattach_2_CentralConnectionNum] FOREIGN KEY ([CentralConnectionNum]) REFERENCES [centralconnection] ([CentralConnectionNum]);
GO

ALTER TABLE [covspan] ADD CONSTRAINT [fk_covspan_1_CovCatNum] FOREIGN KEY ([CovCatNum]) REFERENCES [covcat] ([CovCatNum]);
GO

ALTER TABLE [procbutton] ADD CONSTRAINT [fk_procbutton_1_Category] FOREIGN KEY ([Category]) REFERENCES [definition] ([DefNum]);
GO

ALTER TABLE [hl7def] ADD CONSTRAINT [fk_hl7def_1_LabResultImageCat] FOREIGN KEY ([LabResultImageCat]) REFERENCES [definition] ([DefNum]);
GO

ALTER TABLE [eform] ADD CONSTRAINT [fk_eform_1_SaveImageCategory] FOREIGN KEY ([SaveImageCategory]) REFERENCES [definition] ([DefNum]);
GO

ALTER TABLE [lettermerge] ADD CONSTRAINT [fk_lettermerge_1_Category] FOREIGN KEY ([Category]) REFERENCES [definition] ([DefNum]);
GO

ALTER TABLE [lettermerge] ADD CONSTRAINT [fk_lettermerge_2_ImageFolder] FOREIGN KEY ([ImageFolder]) REFERENCES [definition] ([DefNum]);
GO

ALTER TABLE [accountingautopay] ADD CONSTRAINT [fk_accountingautopay_1_PayType] FOREIGN KEY ([PayType]) REFERENCES [definition] ([DefNum]);
GO

ALTER TABLE [accountingautopay] ADD CONSTRAINT [fk_accountingautopay_2_PickList] FOREIGN KEY ([PickList]) REFERENCES [account] ([AccountNum]);
GO

ALTER TABLE [eformdef] ADD CONSTRAINT [fk_eformdef_1_SaveImageCategory] FOREIGN KEY ([SaveImageCategory]) REFERENCES [definition] ([DefNum]);
GO

ALTER TABLE [insfilingcode] ADD CONSTRAINT [fk_insfilingcode_1_GroupType] FOREIGN KEY ([GroupType]) REFERENCES [definition] ([DefNum]);
GO

ALTER TABLE [deflink] ADD CONSTRAINT [fk_deflink_1_DefNum] FOREIGN KEY ([DefNum]) REFERENCES [definition] ([DefNum]);
GO

ALTER TABLE [deposit] ADD CONSTRAINT [fk_deposit_1_DepositAccountNum] FOREIGN KEY ([DepositAccountNum]) REFERENCES [definition] ([DefNum]);
GO

ALTER TABLE [mountdef] ADD CONSTRAINT [fk_mountdef_1_DefaultCat] FOREIGN KEY ([DefaultCat]) REFERENCES [definition] ([DefNum]);
GO

ALTER TABLE [sheetdef] ADD CONSTRAINT [fk_sheetdef_1_AutoCheckSaveImageDocCategory] FOREIGN KEY ([AutoCheckSaveImageDocCategory]) REFERENCES [definition] ([DefNum]);
GO

ALTER TABLE [contact] ADD CONSTRAINT [fk_contact_1_Category] FOREIGN KEY ([Category]) REFERENCES [definition] ([DefNum]);
GO

ALTER TABLE [cert] ADD CONSTRAINT [fk_cert_1_CertCategoryNum] FOREIGN KEY ([CertCategoryNum]) REFERENCES [definition] ([DefNum]);
GO

ALTER TABLE [autonote] ADD CONSTRAINT [fk_autonote_1_Category] FOREIGN KEY ([Category]) REFERENCES [definition] ([DefNum]);
GO

ALTER TABLE [vaccinedef] ADD CONSTRAINT [fk_vaccinedef_1_DrugManufacturerNum] FOREIGN KEY ([DrugManufacturerNum]) REFERENCES [drugmanufacturer] ([DrugManufacturerNum]);
GO

GO

ALTER TABLE [languagepat] ADD CONSTRAINT [fk_languagepat_2_EFormFieldDefNum] FOREIGN KEY ([EFormFieldDefNum]) REFERENCES [eformfielddef] ([EFormFieldDefNum]);
GO

ALTER TABLE [timecardrule] ADD CONSTRAINT [fk_timecardrule_1_EmployeeNum] FOREIGN KEY ([EmployeeNum]) REFERENCES [employee] ([EmployeeNum]);
GO

ALTER TABLE [fhircontactpoint] ADD CONSTRAINT [fk_fhircontactpoint_1_FHIRSubscriptionNum] FOREIGN KEY ([FHIRSubscriptionNum]) REFERENCES [fhirsubscription] ([FHIRSubscriptionNum]);
GO

ALTER TABLE [schoolcoursedef] ADD CONSTRAINT [fk_schoolcoursedef_1_GradingScaleNum] FOREIGN KEY ([GradingScaleNum]) REFERENCES [gradingscale] ([GradingScaleNum]);
GO

ALTER TABLE [gradingscaleitem] ADD CONSTRAINT [fk_gradingscaleitem_1_GradingScaleNum] FOREIGN KEY ([GradingScaleNum]) REFERENCES [gradingscale] ([GradingScaleNum]);
GO

ALTER TABLE [allergydef] ADD CONSTRAINT [fk_allergydef_1_MedicationNum] FOREIGN KEY ([MedicationNum]) REFERENCES [medication] ([MedicationNum]);
GO

ALTER TABLE [orthorx] ADD CONSTRAINT [fk_orthorx_1_OrthoHardwareSpecNum] FOREIGN KEY ([OrthoHardwareSpecNum]) REFERENCES [orthohardwarespec] ([OrthoHardwareSpecNum]);
GO

ALTER TABLE [patfieldpickitem] ADD CONSTRAINT [fk_patfieldpickitem_1_PatFieldDefNum] FOREIGN KEY ([PatFieldDefNum]) REFERENCES [patfielddef] ([PatFieldDefNum]);
GO

ALTER TABLE [toolbutitem] ADD CONSTRAINT [fk_toolbutitem_1_ProgramNum] FOREIGN KEY ([ProgramNum]) REFERENCES [program] ([ProgramNum]);
GO

ALTER TABLE [quickpastenote] ADD CONSTRAINT [fk_quickpastenote_1_QuickPasteCatNum] FOREIGN KEY ([QuickPasteCatNum]) REFERENCES [quickpastecat] ([QuickPasteCatNum]);
GO

ALTER TABLE [requiredfieldcondition] ADD CONSTRAINT [fk_requiredfieldcondition_1_RequiredFieldNum] FOREIGN KEY ([RequiredFieldNum]) REFERENCES [requiredfield] ([RequiredFieldNum]);
GO

ALTER TABLE [schoolcourse] ADD CONSTRAINT [fk_schoolcourse_1_SchoolClassNum] FOREIGN KEY ([SchoolClassNum]) REFERENCES [schoolclass] ([SchoolClassNum]);
GO

ALTER TABLE [schoolcourse] ADD CONSTRAINT [fk_schoolcourse_2_GradingScaleNum] FOREIGN KEY ([GradingScaleNum]) REFERENCES [gradingscale] ([GradingScaleNum]);
GO

ALTER TABLE [sigmessage] ADD CONSTRAINT [fk_sigmessage_1_SigElementDefNumUser] FOREIGN KEY ([SigElementDefNumUser]) REFERENCES [sigelementdef] ([SigElementDefNum]);
GO

ALTER TABLE [sigmessage] ADD CONSTRAINT [fk_sigmessage_2_SigElementDefNumExtra] FOREIGN KEY ([SigElementDefNumExtra]) REFERENCES [sigelementdef] ([SigElementDefNum]);
GO

ALTER TABLE [sigmessage] ADD CONSTRAINT [fk_sigmessage_3_SigElementDefNumMsg] FOREIGN KEY ([SigElementDefNumMsg]) REFERENCES [sigelementdef] ([SigElementDefNum]);
GO

ALTER TABLE [sigbutdef] ADD CONSTRAINT [fk_sigbutdef_1_SigElementDefNumUser] FOREIGN KEY ([SigElementDefNumUser]) REFERENCES [sigelementdef] ([SigElementDefNum]);
GO

ALTER TABLE [sigbutdef] ADD CONSTRAINT [fk_sigbutdef_2_SigElementDefNumExtra] FOREIGN KEY ([SigElementDefNumExtra]) REFERENCES [sigelementdef] ([SigElementDefNum]);
GO

ALTER TABLE [sigbutdef] ADD CONSTRAINT [fk_sigbutdef_3_SigElementDefNumMsg] FOREIGN KEY ([SigElementDefNumMsg]) REFERENCES [sigelementdef] ([SigElementDefNum]);
GO

ALTER TABLE [diseasedef] ADD CONSTRAINT [fk_diseasedef_1_ICD9Code] FOREIGN KEY ([ICD9Code]) REFERENCES [icd9] ([Icd9Code]);
GO

ALTER TABLE [diseasedef] ADD CONSTRAINT [fk_diseasedef_2_SnomedCode] FOREIGN KEY ([SnomedCode]) REFERENCES [snomed] ([SnomedCode]);
GO

ALTER TABLE [diseasedef] ADD CONSTRAINT [fk_diseasedef_3_Icd10Code] FOREIGN KEY ([Icd10Code]) REFERENCES [icd10] ([Icd10Code]);
GO

ALTER TABLE [supply] ADD CONSTRAINT [fk_supply_1_SupplierNum] FOREIGN KEY ([SupplierNum]) REFERENCES [supplier] ([SupplierNum]);
GO

ALTER TABLE [supply] ADD CONSTRAINT [fk_supply_2_Category] FOREIGN KEY ([Category]) REFERENCES [definition] ([DefNum]);
GO

ALTER TABLE [grouppermission] ADD CONSTRAINT [fk_grouppermission_1_UserGroupNum] FOREIGN KEY ([UserGroupNum]) REFERENCES [usergroup] ([UserGroupNum]);
GO

ALTER TABLE [orthocharttablink] ADD CONSTRAINT [fk_orthocharttablink_1_OrthoChartTabNum] FOREIGN KEY ([OrthoChartTabNum]) REFERENCES [orthocharttab] ([OrthoChartTabNum]);
GO

ALTER TABLE [orthocharttablink] ADD CONSTRAINT [fk_orthocharttablink_2_DisplayFieldNum] FOREIGN KEY ([DisplayFieldNum]) REFERENCES [displayfield] ([DisplayFieldNum]);
GO

ALTER TABLE [hl7defmessage] ADD CONSTRAINT [fk_hl7defmessage_1_HL7DefNum] FOREIGN KEY ([HL7DefNum]) REFERENCES [hl7def] ([HL7DefNum]);
GO

ALTER TABLE [lettermergefield] ADD CONSTRAINT [fk_lettermergefield_1_LetterMergeNum] FOREIGN KEY ([LetterMergeNum]) REFERENCES [lettermerge] ([LetterMergeNum]);
GO

ALTER TABLE [insfilingcodesubtype] ADD CONSTRAINT [fk_insfilingcodesubtype_1_InsFilingCodeNum] FOREIGN KEY ([InsFilingCodeNum]) REFERENCES [insfilingcode] ([insfilingcodenum]);
GO

ALTER TABLE [mountitemdef] ADD CONSTRAINT [fk_mountitemdef_1_MountDefNum] FOREIGN KEY ([MountDefNum]) REFERENCES [mountdef] ([MountDefNum]);
GO

ALTER TABLE [laboratory] ADD CONSTRAINT [fk_laboratory_1_Slip] FOREIGN KEY ([Slip]) REFERENCES [sheetdef] ([SheetDefNum]);
GO

ALTER TABLE [sheetfielddef] ADD CONSTRAINT [fk_sheetfielddef_1_SheetDefNum] FOREIGN KEY ([SheetDefNum]) REFERENCES [sheetdef] ([SheetDefNum]);
GO

ALTER TABLE [automation] ADD CONSTRAINT [fk_automation_1_SheetDefNum] FOREIGN KEY ([SheetDefNum]) REFERENCES [sheetdef] ([SheetDefNum]);
GO

ALTER TABLE [automation] ADD CONSTRAINT [fk_automation_2_CommType] FOREIGN KEY ([CommType]) REFERENCES [definition] ([DefNum]);
GO

ALTER TABLE [automation] ADD CONSTRAINT [fk_automation_3_AppointmentTypeNum] FOREIGN KEY ([AppointmentTypeNum]) REFERENCES [appointmenttype] ([AppointmentTypeNum]);
GO

ALTER TABLE [evaluationdef] ADD CONSTRAINT [fk_evaluationdef_1_SchoolCourseNum] FOREIGN KEY ([SchoolCourseNum]) REFERENCES [schoolcourse] ([SchoolCourseNum]);
GO

ALTER TABLE [evaluationdef] ADD CONSTRAINT [fk_evaluationdef_2_SchoolCourseDefNum] FOREIGN KEY ([SchoolCourseDefNum]) REFERENCES [schoolcoursedef] ([SchoolCourseDefNum]);
GO

ALTER TABLE [schoolcoursesched] ADD CONSTRAINT [fk_schoolcoursesched_1_SchoolCourseDefNum] FOREIGN KEY ([SchoolCourseDefNum]) REFERENCES [schoolcoursedef] ([SchoolCourseDefNum]);
GO

ALTER TABLE [schoolcoursesched] ADD CONSTRAINT [fk_schoolcoursesched_2_SchoolCourseNum] FOREIGN KEY ([SchoolCourseNum]) REFERENCES [schoolcourse] ([SchoolCourseNum]);
GO

ALTER TABLE [reqneeded] ADD CONSTRAINT [fk_reqneeded_1_SchoolCourseNum] FOREIGN KEY ([SchoolCourseNum]) REFERENCES [schoolcourse] ([SchoolCourseNum]);
GO

ALTER TABLE [reqneeded] ADD CONSTRAINT [fk_reqneeded_2_SchoolClassNum] FOREIGN KEY ([SchoolClassNum]) REFERENCES [schoolclass] ([SchoolClassNum]);
GO

ALTER TABLE [reqneeded] ADD CONSTRAINT [fk_reqneeded_3_SchoolCourseDefNum] FOREIGN KEY ([SchoolCourseDefNum]) REFERENCES [schoolcoursedef] ([SchoolCourseDefNum]);
GO

ALTER TABLE [rxalert] ADD CONSTRAINT [fk_rxalert_1_RxDefNum] FOREIGN KEY ([RxDefNum]) REFERENCES [rxdef] ([RxDefNum]);
GO

ALTER TABLE [rxalert] ADD CONSTRAINT [fk_rxalert_2_DiseaseDefNum] FOREIGN KEY ([DiseaseDefNum]) REFERENCES [diseasedef] ([DiseaseDefNum]);
GO

ALTER TABLE [rxalert] ADD CONSTRAINT [fk_rxalert_3_AllergyDefNum] FOREIGN KEY ([AllergyDefNum]) REFERENCES [allergydef] ([AllergyDefNum]);
GO

ALTER TABLE [rxalert] ADD CONSTRAINT [fk_rxalert_4_MedicationNum] FOREIGN KEY ([MedicationNum]) REFERENCES [medication] ([MedicationNum]);
GO

ALTER TABLE [hl7defsegment] ADD CONSTRAINT [fk_hl7defsegment_1_HL7DefMessageNum] FOREIGN KEY ([HL7DefMessageNum]) REFERENCES [hl7defmessage] ([HL7DefMessageNum]);
GO

ALTER TABLE [labturnaround] ADD CONSTRAINT [fk_labturnaround_1_LaboratoryNum] FOREIGN KEY ([LaboratoryNum]) REFERENCES [laboratory] ([LaboratoryNum]);
GO

ALTER TABLE [automationcondition] ADD CONSTRAINT [fk_automationcondition_1_AutomationNum] FOREIGN KEY ([AutomationNum]) REFERENCES [automation] ([AutomationNum]);
GO

ALTER TABLE [evaluationcriteriondef] ADD CONSTRAINT [fk_evaluationcriteriondef_1_EvaluationDefNum] FOREIGN KEY ([EvaluationDefNum]) REFERENCES [evaluationdef] ([EvaluationDefNum]);
GO

ALTER TABLE [activeinstance] ADD CONSTRAINT [fk_activeinstance_1_ComputerNum] FOREIGN KEY ([ComputerNum]) REFERENCES [computer] ([ComputerNum]);
GO

ALTER TABLE [activeinstance] ADD CONSTRAINT [fk_activeinstance_2_UserNum] FOREIGN KEY ([UserNum]) REFERENCES [userod] ([UserNum]);
GO

ALTER TABLE [adjustment] ADD CONSTRAINT [fk_adjustment_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [patient] ([PatNum]);
GO

ALTER TABLE [adjustment] ADD CONSTRAINT [fk_adjustment_2_AdjType] FOREIGN KEY ([AdjType]) REFERENCES [definition] ([DefNum]);
GO

ALTER TABLE [adjustment] ADD CONSTRAINT [fk_adjustment_3_ProvNum] FOREIGN KEY ([ProvNum]) REFERENCES [provider] ([ProvNum]);
GO

ALTER TABLE [adjustment] ADD CONSTRAINT [fk_adjustment_4_ProcNum] FOREIGN KEY ([ProcNum]) REFERENCES [procedurelog] ([ProcNum]);
GO

ALTER TABLE [adjustment] ADD CONSTRAINT [fk_adjustment_5_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [clinic] ([ClinicNum]);
GO

ALTER TABLE [adjustment] ADD CONSTRAINT [fk_adjustment_6_StatementNum] FOREIGN KEY ([StatementNum]) REFERENCES [statement] ([StatementNum]);
GO

ALTER TABLE [adjustment] ADD CONSTRAINT [fk_adjustment_7_SecUserNumEntry] FOREIGN KEY ([SecUserNumEntry]) REFERENCES [userod] ([UserNum]);
GO

ALTER TABLE [alertitem] ADD CONSTRAINT [fk_alertitem_1_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [clinic] ([ClinicNum]);
GO

ALTER TABLE [alertitem] ADD CONSTRAINT [fk_alertitem_2_UserNum] FOREIGN KEY ([UserNum]) REFERENCES [userod] ([UserNum]);
GO

ALTER TABLE [alertread] ADD CONSTRAINT [fk_alertread_1_AlertItemNum] FOREIGN KEY ([AlertItemNum]) REFERENCES [alertitem] ([AlertItemNum]);
GO

ALTER TABLE [alertread] ADD CONSTRAINT [fk_alertread_2_UserNum] FOREIGN KEY ([UserNum]) REFERENCES [userod] ([UserNum]);
GO

ALTER TABLE [alertsub] ADD CONSTRAINT [fk_alertsub_1_UserNum] FOREIGN KEY ([UserNum]) REFERENCES [userod] ([UserNum]);
GO

ALTER TABLE [alertsub] ADD CONSTRAINT [fk_alertsub_2_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [clinic] ([ClinicNum]);
GO

ALTER TABLE [alertsub] ADD CONSTRAINT [fk_alertsub_3_AlertCategoryNum] FOREIGN KEY ([AlertCategoryNum]) REFERENCES [alertcategory] ([AlertCategoryNum]);
GO

ALTER TABLE [allergy] ADD CONSTRAINT [fk_allergy_1_AllergyDefNum] FOREIGN KEY ([AllergyDefNum]) REFERENCES [allergydef] ([AllergyDefNum]);
GO

ALTER TABLE [allergy] ADD CONSTRAINT [fk_allergy_2_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [patient] ([PatNum]);
GO

ALTER TABLE [appointment] ADD CONSTRAINT [fk_appointment_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [patient] ([PatNum]);
GO

ALTER TABLE [appointment] ADD CONSTRAINT [fk_appointment_2_Confirmed] FOREIGN KEY ([Confirmed]) REFERENCES [definition] ([DefNum]);
GO

ALTER TABLE [appointment] ADD CONSTRAINT [fk_appointment_3_Op] FOREIGN KEY ([Op]) REFERENCES [operatory] ([OperatoryNum]);
GO

ALTER TABLE [appointment] ADD CONSTRAINT [fk_appointment_4_ProvNum] FOREIGN KEY ([ProvNum]) REFERENCES [provider] ([ProvNum]);
GO

ALTER TABLE [appointment] ADD CONSTRAINT [fk_appointment_5_ProvHyg] FOREIGN KEY ([ProvHyg]) REFERENCES [provider] ([ProvNum]);
GO

ALTER TABLE [appointment] ADD CONSTRAINT [fk_appointment_6_NextAptNum] FOREIGN KEY ([NextAptNum]) REFERENCES [appointment] ([AptNum]);
GO

ALTER TABLE [appointment] ADD CONSTRAINT [fk_appointment_7_UnschedStatus] FOREIGN KEY ([UnschedStatus]) REFERENCES [definition] ([DefNum]);
GO

ALTER TABLE [appointment] ADD CONSTRAINT [fk_appointment_8_Assistant] FOREIGN KEY ([Assistant]) REFERENCES [employee] ([EmployeeNum]);
GO

ALTER TABLE [appointment] ADD CONSTRAINT [fk_appointment_9_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [clinic] ([ClinicNum]);
GO

ALTER TABLE [appointment] ADD CONSTRAINT [fk_appointment_10_InsPlan1] FOREIGN KEY ([InsPlan1]) REFERENCES [insplan] ([PlanNum]);
GO

ALTER TABLE [appointment] ADD CONSTRAINT [fk_appointment_11_InsPlan2] FOREIGN KEY ([InsPlan2]) REFERENCES [insplan] ([PlanNum]);
GO

ALTER TABLE [appointment] ADD CONSTRAINT [fk_appointment_12_AppointmentTypeNum] FOREIGN KEY ([AppointmentTypeNum]) REFERENCES [appointmenttype] ([AppointmentTypeNum]);
GO

ALTER TABLE [appointment] ADD CONSTRAINT [fk_appointment_13_SecUserNumEntry] FOREIGN KEY ([SecUserNumEntry]) REFERENCES [userod] ([UserNum]);
GO

ALTER TABLE [apptfield] ADD CONSTRAINT [fk_apptfield_1_AptNum] FOREIGN KEY ([AptNum]) REFERENCES [appointment] ([AptNum]);
GO

ALTER TABLE [apptfield] ADD CONSTRAINT [fk_apptfield_2_FieldName] FOREIGN KEY ([FieldName]) REFERENCES [apptfielddef] ([FieldName]);
GO

ALTER TABLE [apptgeneralmessagesent] ADD CONSTRAINT [fk_apptgeneralmessagesent_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [patient] ([PatNum]);
GO

ALTER TABLE [apptgeneralmessagesent] ADD CONSTRAINT [fk_apptgeneralmessagesent_2_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [clinic] ([ClinicNum]);
GO

ALTER TABLE [apptgeneralmessagesent] ADD CONSTRAINT [fk_apptgeneralmessagesent_3_ApptReminderRuleNum] FOREIGN KEY ([ApptReminderRuleNum]) REFERENCES [apptreminderrule] ([ApptReminderRuleNum]);
GO

ALTER TABLE [apptnewpatthankyousent] ADD CONSTRAINT [fk_apptnewpatthankyousent_1_ApptReminderRuleNum] FOREIGN KEY ([ApptReminderRuleNum]) REFERENCES [apptreminderrule] ([ApptReminderRuleNum]);
GO

ALTER TABLE [apptnewpatthankyousent] ADD CONSTRAINT [fk_apptnewpatthankyousent_2_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [clinic] ([ClinicNum]);
GO

ALTER TABLE [apptnewpatthankyousent] ADD CONSTRAINT [fk_apptnewpatthankyousent_3_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [patient] ([PatNum]);
GO

ALTER TABLE [apptreminderrule] ADD CONSTRAINT [fk_apptreminderrule_1_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [clinic] ([ClinicNum]);
GO

ALTER TABLE [apptreminderrule] ADD CONSTRAINT [fk_apptreminderrule_2_EmailHostingTemplateNum] FOREIGN KEY ([EmailHostingTemplateNum]) REFERENCES [emailhostingtemplate] ([EmailHostingTemplateNum]);
GO

ALTER TABLE [apptremindersent] ADD CONSTRAINT [fk_apptremindersent_1_ApptReminderRuleNum] FOREIGN KEY ([ApptReminderRuleNum]) REFERENCES [apptreminderrule] ([ApptReminderRuleNum]);
GO

ALTER TABLE [apptremindersent] ADD CONSTRAINT [fk_apptremindersent_2_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [patient] ([PatNum]);
GO

ALTER TABLE [apptremindersent] ADD CONSTRAINT [fk_apptremindersent_3_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [clinic] ([ClinicNum]);
GO

ALTER TABLE [apptthankyousent] ADD CONSTRAINT [fk_apptthankyousent_1_ApptReminderRuleNum] FOREIGN KEY ([ApptReminderRuleNum]) REFERENCES [apptreminderrule] ([ApptReminderRuleNum]);
GO

ALTER TABLE [apptthankyousent] ADD CONSTRAINT [fk_apptthankyousent_2_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [clinic] ([ClinicNum]);
GO

ALTER TABLE [apptthankyousent] ADD CONSTRAINT [fk_apptthankyousent_3_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [patient] ([PatNum]);
GO

ALTER TABLE [apptview] ADD CONSTRAINT [fk_apptview_1_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [clinic] ([ClinicNum]);
GO

ALTER TABLE [apptviewitem] ADD CONSTRAINT [fk_apptviewitem_1_ApptViewNum] FOREIGN KEY ([ApptViewNum]) REFERENCES [apptview] ([ApptViewNum]);
GO

ALTER TABLE [apptviewitem] ADD CONSTRAINT [fk_apptviewitem_2_OpNum] FOREIGN KEY ([OpNum]) REFERENCES [operatory] ([OperatoryNum]);
GO

ALTER TABLE [apptviewitem] ADD CONSTRAINT [fk_apptviewitem_3_ProvNum] FOREIGN KEY ([ProvNum]) REFERENCES [provider] ([ProvNum]);
GO

ALTER TABLE [apptviewitem] ADD CONSTRAINT [fk_apptviewitem_4_ApptFieldDefNum] FOREIGN KEY ([ApptFieldDefNum]) REFERENCES [apptfielddef] ([ApptFieldDefNum]);
GO

ALTER TABLE [apptviewitem] ADD CONSTRAINT [fk_apptviewitem_5_PatFieldDefNum] FOREIGN KEY ([PatFieldDefNum]) REFERENCES [patfielddef] ([PatFieldDefNum]);
GO

ALTER TABLE [asapcomm] ADD CONSTRAINT [fk_asapcomm_1_ScheduleNum] FOREIGN KEY ([ScheduleNum]) REFERENCES [schedule] ([ScheduleNum]);
GO

ALTER TABLE [asapcomm] ADD CONSTRAINT [fk_asapcomm_2_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [patient] ([PatNum]);
GO

ALTER TABLE [asapcomm] ADD CONSTRAINT [fk_asapcomm_3_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [clinic] ([ClinicNum]);
GO

ALTER TABLE [asapcomm] ADD CONSTRAINT [fk_asapcomm_4_EmailMessageNum] FOREIGN KEY ([EmailMessageNum]) REFERENCES [emailmessage] ([EmailMessageNum]);
GO

ALTER TABLE [asapcomm] ADD CONSTRAINT [fk_asapcomm_5_GuidMessageToMobile] FOREIGN KEY ([GuidMessageToMobile]) REFERENCES [smstomobile] ([GuidMessage]);
GO

ALTER TABLE [asapcomm] ADD CONSTRAINT [fk_asapcomm_6_UserNum] FOREIGN KEY ([UserNum]) REFERENCES [userod] ([UserNum]);
GO

ALTER TABLE [autocodecond] ADD CONSTRAINT [fk_autocodecond_1_AutoCodeItemNum] FOREIGN KEY ([AutoCodeItemNum]) REFERENCES [autocodeitem] ([AutoCodeItemNum]);
GO

ALTER TABLE [autocodeitem] ADD CONSTRAINT [fk_autocodeitem_1_AutoCodeNum] FOREIGN KEY ([AutoCodeNum]) REFERENCES [autocode] ([AutoCodeNum]);
GO

ALTER TABLE [autocodeitem] ADD CONSTRAINT [fk_autocodeitem_2_CodeNum] FOREIGN KEY ([CodeNum]) REFERENCES [procedurecode] ([CodeNum]);
GO

ALTER TABLE [benefit] ADD CONSTRAINT [fk_benefit_1_PlanNum] FOREIGN KEY ([PlanNum]) REFERENCES [insplan] ([PlanNum]);
GO

ALTER TABLE [benefit] ADD CONSTRAINT [fk_benefit_2_PatPlanNum] FOREIGN KEY ([PatPlanNum]) REFERENCES [patplan] ([PatPlanNum]);
GO

ALTER TABLE [benefit] ADD CONSTRAINT [fk_benefit_3_CovCatNum] FOREIGN KEY ([CovCatNum]) REFERENCES [covcat] ([CovCatNum]);
GO

ALTER TABLE [benefit] ADD CONSTRAINT [fk_benefit_4_CodeNum] FOREIGN KEY ([CodeNum]) REFERENCES [procedurecode] ([CodeNum]);
GO

ALTER TABLE [benefit] ADD CONSTRAINT [fk_benefit_5_CodeGroupNum] FOREIGN KEY ([CodeGroupNum]) REFERENCES [codegroup] ([CodeGroupNum]);
GO

ALTER TABLE [branding] ADD CONSTRAINT [fk_branding_1_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [clinic] ([ClinicNum]);
GO

ALTER TABLE [carecreditwebresponse] ADD CONSTRAINT [fk_carecreditwebresponse_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [patient] ([PatNum]);
GO

ALTER TABLE [carecreditwebresponse] ADD CONSTRAINT [fk_carecreditwebresponse_2_PayNum] FOREIGN KEY ([PayNum]) REFERENCES [payment] ([PayNum]);
GO

ALTER TABLE [carecreditwebresponse] ADD CONSTRAINT [fk_carecreditwebresponse_3_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [clinic] ([ClinicNum]);
GO

ALTER TABLE [carrier] ADD CONSTRAINT [fk_carrier_1_CanadianNetworkNum] FOREIGN KEY ([CanadianNetworkNum]) REFERENCES [canadiannetwork] ([CanadianNetworkNum]);
GO

ALTER TABLE [carrier] ADD CONSTRAINT [fk_carrier_2_SecUserNumEntry] FOREIGN KEY ([SecUserNumEntry]) REFERENCES [userod] ([UserNum]);
GO

ALTER TABLE [carrier] ADD CONSTRAINT [fk_carrier_3_CarrierGroupName] FOREIGN KEY ([CarrierGroupName]) REFERENCES [definition] ([DefNum]);
GO

ALTER TABLE [cdspermission] ADD CONSTRAINT [fk_cdspermission_1_UserNum] FOREIGN KEY ([UserNum]) REFERENCES [userod] ([UserNum]);
GO

ALTER TABLE [certemployee] ADD CONSTRAINT [fk_certemployee_1_CertNum] FOREIGN KEY ([CertNum]) REFERENCES [cert] ([CertNum]);
GO

ALTER TABLE [certemployee] ADD CONSTRAINT [fk_certemployee_2_EmployeeNum] FOREIGN KEY ([EmployeeNum]) REFERENCES [employee] ([EmployeeNum]);
GO

ALTER TABLE [certemployee] ADD CONSTRAINT [fk_certemployee_3_UserNum] FOREIGN KEY ([UserNum]) REFERENCES [userod] ([UserNum]);
GO

ALTER TABLE [chatattach] ADD CONSTRAINT [fk_chatattach_1_ChatMsgNum] FOREIGN KEY ([ChatMsgNum]) REFERENCES [chatmsg] ([ChatMsgNum]);
GO

ALTER TABLE [chatmsg] ADD CONSTRAINT [fk_chatmsg_1_ChatNum] FOREIGN KEY ([ChatNum]) REFERENCES [chat] ([ChatNum]);
GO

ALTER TABLE [chatmsg] ADD CONSTRAINT [fk_chatmsg_2_UserNum] FOREIGN KEY ([UserNum]) REFERENCES [userod] ([UserNum]);
GO

ALTER TABLE [chatmsg] ADD CONSTRAINT [fk_chatmsg_3_Quote] FOREIGN KEY ([Quote]) REFERENCES [chatmsg] ([ChatMsgNum]);
GO

ALTER TABLE [chatreaction] ADD CONSTRAINT [fk_chatreaction_1_ChatMsgNum] FOREIGN KEY ([ChatMsgNum]) REFERENCES [chatmsg] ([ChatMsgNum]);
GO

ALTER TABLE [chatreaction] ADD CONSTRAINT [fk_chatreaction_2_UserNum] FOREIGN KEY ([UserNum]) REFERENCES [userod] ([UserNum]);
GO

ALTER TABLE [chatuserattach] ADD CONSTRAINT [fk_chatuserattach_1_UserNum] FOREIGN KEY ([UserNum]) REFERENCES [userod] ([UserNum]);
GO

ALTER TABLE [chatuserattach] ADD CONSTRAINT [fk_chatuserattach_2_ChatNum] FOREIGN KEY ([ChatNum]) REFERENCES [chat] ([ChatNum]);
GO

ALTER TABLE [chatuserod] ADD CONSTRAINT [fk_chatuserod_1_UserNum] FOREIGN KEY ([UserNum]) REFERENCES [userod] ([UserNum]);
GO

ALTER TABLE [claim] ADD CONSTRAINT [fk_claim_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [patient] ([PatNum]);
GO

ALTER TABLE [claim] ADD CONSTRAINT [fk_claim_2_PlanNum] FOREIGN KEY ([PlanNum]) REFERENCES [insplan] ([PlanNum]);
GO

ALTER TABLE [claim] ADD CONSTRAINT [fk_claim_3_ProvTreat] FOREIGN KEY ([ProvTreat]) REFERENCES [provider] ([ProvNum]);
GO

ALTER TABLE [claim] ADD CONSTRAINT [fk_claim_4_ProvBill] FOREIGN KEY ([ProvBill]) REFERENCES [provider] ([ProvNum]);
GO

ALTER TABLE [claim] ADD CONSTRAINT [fk_claim_5_ReferringProv] FOREIGN KEY ([ReferringProv]) REFERENCES [referral] ([ReferralNum]);
GO

ALTER TABLE [claim] ADD CONSTRAINT [fk_claim_6_PlanNum2] FOREIGN KEY ([PlanNum2]) REFERENCES [insplan] ([PlanNum]);
GO

ALTER TABLE [claim] ADD CONSTRAINT [fk_claim_7_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [clinic] ([ClinicNum]);
GO

ALTER TABLE [claim] ADD CONSTRAINT [fk_claim_8_ClaimForm] FOREIGN KEY ([ClaimForm]) REFERENCES [claimform] ([ClaimFormNum]);
GO

ALTER TABLE [claim] ADD CONSTRAINT [fk_claim_9_InsSubNum] FOREIGN KEY ([InsSubNum]) REFERENCES [inssub] ([InsSubNum]);
GO

ALTER TABLE [claim] ADD CONSTRAINT [fk_claim_10_InsSubNum2] FOREIGN KEY ([InsSubNum2]) REFERENCES [inssub] ([InsSubNum]);
GO

ALTER TABLE [claim] ADD CONSTRAINT [fk_claim_11_CustomTracking] FOREIGN KEY ([CustomTracking]) REFERENCES [definition] ([DefNum]);
GO

ALTER TABLE [claim] ADD CONSTRAINT [fk_claim_12_ProvOrderOverride] FOREIGN KEY ([ProvOrderOverride]) REFERENCES [provider] ([ProvNum]);
GO

ALTER TABLE [claim] ADD CONSTRAINT [fk_claim_13_SecUserNumEntry] FOREIGN KEY ([SecUserNumEntry]) REFERENCES [userod] ([UserNum]);
GO

ALTER TABLE [claim] ADD CONSTRAINT [fk_claim_14_OrderingReferralNum] FOREIGN KEY ([OrderingReferralNum]) REFERENCES [referral] ([ReferralNum]);
GO

ALTER TABLE [claimattach] ADD CONSTRAINT [fk_claimattach_1_ClaimNum] FOREIGN KEY ([ClaimNum]) REFERENCES [claim] ([ClaimNum]);
GO

ALTER TABLE [claimcondcodelog] ADD CONSTRAINT [fk_claimcondcodelog_1_ClaimNum] FOREIGN KEY ([ClaimNum]) REFERENCES [claim] ([ClaimNum]);
GO

ALTER TABLE [claimpayment] ADD CONSTRAINT [fk_claimpayment_1_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [clinic] ([ClinicNum]);
GO

ALTER TABLE [claimpayment] ADD CONSTRAINT [fk_claimpayment_2_DepositNum] FOREIGN KEY ([DepositNum]) REFERENCES [deposit] ([DepositNum]);
GO

ALTER TABLE [claimpayment] ADD CONSTRAINT [fk_claimpayment_3_PayType] FOREIGN KEY ([PayType]) REFERENCES [definition] ([DefNum]);
GO

ALTER TABLE [claimpayment] ADD CONSTRAINT [fk_claimpayment_4_SecUserNumEntry] FOREIGN KEY ([SecUserNumEntry]) REFERENCES [userod] ([UserNum]);
GO

ALTER TABLE [claimpayment] ADD CONSTRAINT [fk_claimpayment_5_PayGroup] FOREIGN KEY ([PayGroup]) REFERENCES [definition] ([DefNum]);
GO

ALTER TABLE [claimproc] ADD CONSTRAINT [fk_claimproc_1_ProcNum] FOREIGN KEY ([ProcNum]) REFERENCES [procedurelog] ([ProcNum]);
GO

ALTER TABLE [claimproc] ADD CONSTRAINT [fk_claimproc_2_ClaimNum] FOREIGN KEY ([ClaimNum]) REFERENCES [claim] ([ClaimNum]);
GO

ALTER TABLE [claimproc] ADD CONSTRAINT [fk_claimproc_3_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [patient] ([PatNum]);
GO

ALTER TABLE [claimproc] ADD CONSTRAINT [fk_claimproc_4_ProvNum] FOREIGN KEY ([ProvNum]) REFERENCES [provider] ([ProvNum]);
GO

ALTER TABLE [claimproc] ADD CONSTRAINT [fk_claimproc_5_ClaimPaymentNum] FOREIGN KEY ([ClaimPaymentNum]) REFERENCES [claimpayment] ([ClaimPaymentNum]);
GO

ALTER TABLE [claimproc] ADD CONSTRAINT [fk_claimproc_6_PlanNum] FOREIGN KEY ([PlanNum]) REFERENCES [insplan] ([PlanNum]);
GO

ALTER TABLE [claimproc] ADD CONSTRAINT [fk_claimproc_7_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [clinic] ([ClinicNum]);
GO

ALTER TABLE [claimproc] ADD CONSTRAINT [fk_claimproc_8_InsSubNum] FOREIGN KEY ([InsSubNum]) REFERENCES [inssub] ([InsSubNum]);
GO

ALTER TABLE [claimproc] ADD CONSTRAINT [fk_claimproc_9_PayPlanNum] FOREIGN KEY ([PayPlanNum]) REFERENCES [payplan] ([PayPlanNum]);
GO

ALTER TABLE [claimproc] ADD CONSTRAINT [fk_claimproc_10_ClaimPaymentTracking] FOREIGN KEY ([ClaimPaymentTracking]) REFERENCES [definition] ([DefNum]);
GO

ALTER TABLE [claimproc] ADD CONSTRAINT [fk_claimproc_11_SecUserNumEntry] FOREIGN KEY ([SecUserNumEntry]) REFERENCES [userod] ([UserNum]);
GO

ALTER TABLE [claimsnapshot] ADD CONSTRAINT [fk_claimsnapshot_1_ProcNum] FOREIGN KEY ([ProcNum]) REFERENCES [procedurelog] ([ProcNum]);
GO

ALTER TABLE [claimsnapshot] ADD CONSTRAINT [fk_claimsnapshot_2_ClaimProcNum] FOREIGN KEY ([ClaimProcNum]) REFERENCES [claimproc] ([ClaimProcNum]);
GO

ALTER TABLE [claimtracking] ADD CONSTRAINT [fk_claimtracking_1_ClaimNum] FOREIGN KEY ([ClaimNum]) REFERENCES [claim] ([ClaimNum]);
GO

ALTER TABLE [claimtracking] ADD CONSTRAINT [fk_claimtracking_2_UserNum] FOREIGN KEY ([UserNum]) REFERENCES [userod] ([UserNum]);
GO

ALTER TABLE [claimtracking] ADD CONSTRAINT [fk_claimtracking_3_TrackingDefNum] FOREIGN KEY ([TrackingDefNum]) REFERENCES [definition] ([DefNum]);
GO

ALTER TABLE [claimtracking] ADD CONSTRAINT [fk_claimtracking_4_TrackingErrorDefNum] FOREIGN KEY ([TrackingErrorDefNum]) REFERENCES [definition] ([DefNum]);
GO

ALTER TABLE [claimvalcodelog] ADD CONSTRAINT [fk_claimvalcodelog_1_ClaimNum] FOREIGN KEY ([ClaimNum]) REFERENCES [claim] ([ClaimNum]);
GO

ALTER TABLE [clearinghouse] ADD CONSTRAINT [fk_clearinghouse_1_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [clinic] ([ClinicNum]);
GO

ALTER TABLE [clearinghouse] ADD CONSTRAINT [fk_clearinghouse_2_HqClearinghouseNum] FOREIGN KEY ([HqClearinghouseNum]) REFERENCES [clearinghouse] ([ClearingHouseNum]);
GO

ALTER TABLE [clinic] ADD CONSTRAINT [fk_clinic_1_InsBillingProv] FOREIGN KEY ([InsBillingProv]) REFERENCES [provider] ([ProvNum]);
GO

ALTER TABLE [clinic] ADD CONSTRAINT [fk_clinic_2_EmailAddressNum] FOREIGN KEY ([EmailAddressNum]) REFERENCES [emailaddress] ([EmailAddressNum]);
GO

ALTER TABLE [clinic] ADD CONSTRAINT [fk_clinic_3_DefaultProv] FOREIGN KEY ([DefaultProv]) REFERENCES [provider] ([ProvNum]);
GO

ALTER TABLE [clinic] ADD CONSTRAINT [fk_clinic_4_Region] FOREIGN KEY ([Region]) REFERENCES [definition] ([DefNum]);
GO

ALTER TABLE [clinic] ADD CONSTRAINT [fk_clinic_5_MedLabAccountNum] FOREIGN KEY ([MedLabAccountNum]) REFERENCES [medlab] ([PatAccountNum]);
GO

ALTER TABLE [clinicerx] ADD CONSTRAINT [fk_clinicerx_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [patient] ([PatNum]);
GO

ALTER TABLE [clinicerx] ADD CONSTRAINT [fk_clinicerx_2_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [clinic] ([ClinicNum]);
GO

ALTER TABLE [clinicerx] ADD CONSTRAINT [fk_clinicerx_3_RegistrationKeyNum] FOREIGN KEY ([RegistrationKeyNum]) REFERENCES [registrationkey] ([RegistrationKeyNum]);
GO

ALTER TABLE [clinicpref] ADD CONSTRAINT [fk_clinicpref_1_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [clinic] ([ClinicNum]);
GO

ALTER TABLE [clockevent] ADD CONSTRAINT [fk_clockevent_1_EmployeeNum] FOREIGN KEY ([EmployeeNum]) REFERENCES [employee] ([EmployeeNum]);
GO

ALTER TABLE [clockevent] ADD CONSTRAINT [fk_clockevent_2_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [clinic] ([ClinicNum]);
GO

ALTER TABLE [cloudaddress] ADD CONSTRAINT [fk_cloudaddress_1_UserNumLastConnect] FOREIGN KEY ([UserNumLastConnect]) REFERENCES [userod] ([UserNum]);
GO

ALTER TABLE [commlog] ADD CONSTRAINT [fk_commlog_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [patient] ([PatNum]);
GO

ALTER TABLE [commlog] ADD CONSTRAINT [fk_commlog_2_CommType] FOREIGN KEY ([CommType]) REFERENCES [definition] ([DefNum]);
GO

ALTER TABLE [commlog] ADD CONSTRAINT [fk_commlog_3_UserNum] FOREIGN KEY ([UserNum]) REFERENCES [userod] ([UserNum]);
GO

ALTER TABLE [commlog] ADD CONSTRAINT [fk_commlog_4_ProgramNum] FOREIGN KEY ([ProgramNum]) REFERENCES [program] ([ProgramNum]);
GO

ALTER TABLE [commlog] ADD CONSTRAINT [fk_commlog_5_ReferralNum] FOREIGN KEY ([ReferralNum]) REFERENCES [referral] ([ReferralNum]);
GO

ALTER TABLE [commoptout] ADD CONSTRAINT [fk_commoptout_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [patient] ([PatNum]);
GO

ALTER TABLE [computerpref] ADD CONSTRAINT [fk_computerpref_1_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [clinic] ([ClinicNum]);
GO

ALTER TABLE [computerpref] ADD CONSTRAINT [fk_computerpref_2_ApptViewNum] FOREIGN KEY ([ApptViewNum]) REFERENCES [apptview] ([ApptViewNum]);
GO

ALTER TABLE [confirmationrequest] ADD CONSTRAINT [fk_confirmationrequest_1_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [clinic] ([ClinicNum]);
GO

ALTER TABLE [confirmationrequest] ADD CONSTRAINT [fk_confirmationrequest_2_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [patient] ([PatNum]);
GO

ALTER TABLE [confirmationrequest] ADD CONSTRAINT [fk_confirmationrequest_3_GuidMessageFromMobile] FOREIGN KEY ([GuidMessageFromMobile]) REFERENCES [smsfrommobile] ([GuidMessage]);
GO

ALTER TABLE [confirmationrequest] ADD CONSTRAINT [fk_confirmationrequest_4_ApptReminderRuleNum] FOREIGN KEY ([ApptReminderRuleNum]) REFERENCES [apptreminderrule] ([ApptReminderRuleNum]);
GO

ALTER TABLE [creditcard] ADD CONSTRAINT [fk_creditcard_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [patient] ([PatNum]);
GO

ALTER TABLE [creditcard] ADD CONSTRAINT [fk_creditcard_2_PayPlanNum] FOREIGN KEY ([PayPlanNum]) REFERENCES [payplan] ([PayPlanNum]);
GO

ALTER TABLE [creditcard] ADD CONSTRAINT [fk_creditcard_3_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [clinic] ([ClinicNum]);
GO

ALTER TABLE [creditcard] ADD CONSTRAINT [fk_creditcard_4_PaymentType] FOREIGN KEY ([PaymentType]) REFERENCES [definition] ([DefNum]);
GO

ALTER TABLE [custrefentry] ADD CONSTRAINT [fk_custrefentry_1_PatNumCust] FOREIGN KEY ([PatNumCust]) REFERENCES [patient] ([PatNum]);
GO

ALTER TABLE [custrefentry] ADD CONSTRAINT [fk_custrefentry_2_PatNumRef] FOREIGN KEY ([PatNumRef]) REFERENCES [patient] ([PatNum]);
GO

ALTER TABLE [custreference] ADD CONSTRAINT [fk_custreference_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [patient] ([PatNum]);
GO

ALTER TABLE [dashboardcell] ADD CONSTRAINT [fk_dashboardcell_1_DashboardLayoutNum] FOREIGN KEY ([DashboardLayoutNum]) REFERENCES [dashboardlayout] ([DashboardLayoutNum]);
GO

ALTER TABLE [dashboardlayout] ADD CONSTRAINT [fk_dashboardlayout_1_UserNum] FOREIGN KEY ([UserNum]) REFERENCES [userod] ([UserNum]);
GO

ALTER TABLE [dashboardlayout] ADD CONSTRAINT [fk_dashboardlayout_2_UserGroupNum] FOREIGN KEY ([UserGroupNum]) REFERENCES [usergroup] ([UserGroupNum]);
GO

ALTER TABLE [dbmlog] ADD CONSTRAINT [fk_dbmlog_1_UserNum] FOREIGN KEY ([UserNum]) REFERENCES [userod] ([UserNum]);
GO

ALTER TABLE [discountplan] ADD CONSTRAINT [fk_discountplan_1_FeeSchedNum] FOREIGN KEY ([FeeSchedNum]) REFERENCES [feesched] ([FeeSchedNum]);
GO

ALTER TABLE [discountplan] ADD CONSTRAINT [fk_discountplan_2_DefNum] FOREIGN KEY ([DefNum]) REFERENCES [definition] ([DefNum]);
GO

ALTER TABLE [discountplansub] ADD CONSTRAINT [fk_discountplansub_1_DiscountPlanNum] FOREIGN KEY ([DiscountPlanNum]) REFERENCES [discountplan] ([DiscountPlanNum]);
GO

ALTER TABLE [discountplansub] ADD CONSTRAINT [fk_discountplansub_2_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [patient] ([PatNum]);
GO

ALTER TABLE [disease] ADD CONSTRAINT [fk_disease_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [patient] ([PatNum]);
GO

ALTER TABLE [disease] ADD CONSTRAINT [fk_disease_2_DiseaseDefNum] FOREIGN KEY ([DiseaseDefNum]) REFERENCES [diseasedef] ([DiseaseDefNum]);
GO

ALTER TABLE [disease] ADD CONSTRAINT [fk_disease_3_SnomedProblemType] FOREIGN KEY ([SnomedProblemType]) REFERENCES [snomed] ([SnomedCode]);
GO

ALTER TABLE [dispsupply] ADD CONSTRAINT [fk_dispsupply_1_SupplyNum] FOREIGN KEY ([SupplyNum]) REFERENCES [supply] ([SupplyNum]);
GO

ALTER TABLE [dispsupply] ADD CONSTRAINT [fk_dispsupply_2_ProvNum] FOREIGN KEY ([ProvNum]) REFERENCES [provider] ([ProvNum]);
GO

ALTER TABLE [document] ADD CONSTRAINT [fk_document_1_DocCategory] FOREIGN KEY ([DocCategory]) REFERENCES [definition] ([DefNum]);
GO

ALTER TABLE [document] ADD CONSTRAINT [fk_document_2_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [patient] ([PatNum]);
GO

ALTER TABLE [document] ADD CONSTRAINT [fk_document_3_MountItemNum] FOREIGN KEY ([MountItemNum]) REFERENCES [mountitem] ([MountItemNum]);
GO

ALTER TABLE [document] ADD CONSTRAINT [fk_document_4_ProvNum] FOREIGN KEY ([ProvNum]) REFERENCES [provider] ([ProvNum]);
GO

ALTER TABLE [document] ADD CONSTRAINT [fk_document_5_UserNum] FOREIGN KEY ([UserNum]) REFERENCES [userod] ([UserNum]);
GO

ALTER TABLE [dunning] ADD CONSTRAINT [fk_dunning_1_BillingType] FOREIGN KEY ([BillingType]) REFERENCES [definition] ([DefNum]);
GO

ALTER TABLE [dunning] ADD CONSTRAINT [fk_dunning_2_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [clinic] ([ClinicNum]);
GO

ALTER TABLE [ebill] ADD CONSTRAINT [fk_ebill_1_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [clinic] ([ClinicNum]);
GO

ALTER TABLE [eclipboardimagecapture] ADD CONSTRAINT [fk_eclipboardimagecapture_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [patient] ([PatNum]);
GO

ALTER TABLE [eclipboardimagecapture] ADD CONSTRAINT [fk_eclipboardimagecapture_2_DefNum] FOREIGN KEY ([DefNum]) REFERENCES [definition] ([DefNum]);
GO

ALTER TABLE [eclipboardimagecapture] ADD CONSTRAINT [fk_eclipboardimagecapture_3_DocNum] FOREIGN KEY ([DocNum]) REFERENCES [document] ([DocNum]);
GO

ALTER TABLE [eclipboardimagecapturedef] ADD CONSTRAINT [fk_eclipboardimagecapturedef_1_DefNum] FOREIGN KEY ([DefNum]) REFERENCES [definition] ([DefNum]);
GO

ALTER TABLE [eclipboardimagecapturedef] ADD CONSTRAINT [fk_eclipboardimagecapturedef_2_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [clinic] ([ClinicNum]);
GO

ALTER TABLE [eclipboardsheetdef] ADD CONSTRAINT [fk_eclipboardsheetdef_1_SheetDefNum] FOREIGN KEY ([SheetDefNum]) REFERENCES [sheetdef] ([SheetDefNum]);
GO

ALTER TABLE [eclipboardsheetdef] ADD CONSTRAINT [fk_eclipboardsheetdef_2_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [clinic] ([ClinicNum]);
GO

ALTER TABLE [eclipboardsheetdef] ADD CONSTRAINT [fk_eclipboardsheetdef_3_EFormDefNum] FOREIGN KEY ([EFormDefNum]) REFERENCES [eformdef] ([EFormDefNum]);
GO

ALTER TABLE [eduresource] ADD CONSTRAINT [fk_eduresource_1_DiseaseDefNum] FOREIGN KEY ([DiseaseDefNum]) REFERENCES [diseasedef] ([DiseaseDefNum]);
GO

ALTER TABLE [eduresource] ADD CONSTRAINT [fk_eduresource_2_MedicationNum] FOREIGN KEY ([MedicationNum]) REFERENCES [medication] ([MedicationNum]);
GO

ALTER TABLE [eduresource] ADD CONSTRAINT [fk_eduresource_3_LabResultID] FOREIGN KEY ([LabResultID]) REFERENCES [labresult] ([TestID]);
GO

ALTER TABLE [eduresource] ADD CONSTRAINT [fk_eduresource_4_SmokingSnoMed] FOREIGN KEY ([SmokingSnoMed]) REFERENCES [ehrmeasureevent] ([CodeValueResult]);
GO

ALTER TABLE [ehramendment] ADD CONSTRAINT [fk_ehramendment_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [patient] ([PatNum]);
GO

ALTER TABLE [ehraptobs] ADD CONSTRAINT [fk_ehraptobs_1_AptNum] FOREIGN KEY ([AptNum]) REFERENCES [appointment] ([AptNum]);
GO

ALTER TABLE [ehrcareplan] ADD CONSTRAINT [fk_ehrcareplan_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [patient] ([PatNum]);
GO

ALTER TABLE [ehrlab] ADD CONSTRAINT [fk_ehrlab_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [patient] ([PatNum]);
GO

ALTER TABLE [ehrlabclinicalinfo] ADD CONSTRAINT [fk_ehrlabclinicalinfo_1_EhrLabNum] FOREIGN KEY ([EhrLabNum]) REFERENCES [ehrlab] ([EhrLabNum]);
GO

ALTER TABLE [ehrlabimage] ADD CONSTRAINT [fk_ehrlabimage_1_EhrLabNum] FOREIGN KEY ([EhrLabNum]) REFERENCES [ehrlab] ([EhrLabNum]);
GO

ALTER TABLE [ehrlabimage] ADD CONSTRAINT [fk_ehrlabimage_2_DocNum] FOREIGN KEY ([DocNum]) REFERENCES [document] ([DocNum]);
GO

ALTER TABLE [ehrlabnote] ADD CONSTRAINT [fk_ehrlabnote_1_EhrLabNum] FOREIGN KEY ([EhrLabNum]) REFERENCES [ehrlab] ([EhrLabNum]);
GO

ALTER TABLE [ehrlabnote] ADD CONSTRAINT [fk_ehrlabnote_2_EhrLabResultNum] FOREIGN KEY ([EhrLabResultNum]) REFERENCES [ehrlabresult] ([EhrLabResultNum]);
GO

ALTER TABLE [ehrlabresult] ADD CONSTRAINT [fk_ehrlabresult_1_EhrLabNum] FOREIGN KEY ([EhrLabNum]) REFERENCES [ehrlab] ([EhrLabNum]);
GO

ALTER TABLE [ehrlabresultscopyto] ADD CONSTRAINT [fk_ehrlabresultscopyto_1_EhrLabNum] FOREIGN KEY ([EhrLabNum]) REFERENCES [ehrlab] ([EhrLabNum]);
GO

ALTER TABLE [ehrlabspecimen] ADD CONSTRAINT [fk_ehrlabspecimen_1_EhrLabNum] FOREIGN KEY ([EhrLabNum]) REFERENCES [ehrlab] ([EhrLabNum]);
GO

ALTER TABLE [ehrlabspecimencondition] ADD CONSTRAINT [fk_ehrlabspecimencondition_1_EhrLabSpecimenNum] FOREIGN KEY ([EhrLabSpecimenNum]) REFERENCES [ehrlabspecimen] ([EhrLabSpecimenNum]);
GO

ALTER TABLE [ehrlabspecimenrejectreason] ADD CONSTRAINT [fk_ehrlabspecimenrejectreason_1_EhrLabSpecimenNum] FOREIGN KEY ([EhrLabSpecimenNum]) REFERENCES [ehrlab] ([EhrLabNum]);
GO

ALTER TABLE [ehrmeasureevent] ADD CONSTRAINT [fk_ehrmeasureevent_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [patient] ([PatNum]);
GO

ALTER TABLE [ehrnotperformed] ADD CONSTRAINT [fk_ehrnotperformed_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [patient] ([PatNum]);
GO

ALTER TABLE [ehrnotperformed] ADD CONSTRAINT [fk_ehrnotperformed_2_ProvNum] FOREIGN KEY ([ProvNum]) REFERENCES [provider] ([ProvNum]);
GO

ALTER TABLE [ehrnotperformed] ADD CONSTRAINT [fk_ehrnotperformed_3_CodeSystem] FOREIGN KEY ([CodeSystem]) REFERENCES [codesystem] ([CodeSystemName]);
GO

ALTER TABLE [ehrnotperformed] ADD CONSTRAINT [fk_ehrnotperformed_4_CodeValueReason] FOREIGN KEY ([CodeValueReason]) REFERENCES [ehrcode] ([CodeValue]);
GO

ALTER TABLE [ehrnotperformed] ADD CONSTRAINT [fk_ehrnotperformed_5_CodeSystemReason] FOREIGN KEY ([CodeSystemReason]) REFERENCES [codesystem] ([CodeSystemName]);
GO

ALTER TABLE [ehrpatient] ADD CONSTRAINT [fk_ehrpatient_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [patient] ([PatNum]);
GO

ALTER TABLE [ehrprovkey] ADD CONSTRAINT [fk_ehrprovkey_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [patient] ([PatNum]);
GO

ALTER TABLE [ehrquarterlykey] ADD CONSTRAINT [fk_ehrquarterlykey_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [patient] ([PatNum]);
GO

ALTER TABLE [ehrsummaryccd] ADD CONSTRAINT [fk_ehrsummaryccd_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [patient] ([PatNum]);
GO

ALTER TABLE [ehrsummaryccd] ADD CONSTRAINT [fk_ehrsummaryccd_2_EmailAttachNum] FOREIGN KEY ([EmailAttachNum]) REFERENCES [emailattach] ([EmailAttachNum]);
GO

ALTER TABLE [emailaddress] ADD CONSTRAINT [fk_emailaddress_1_UserNum] FOREIGN KEY ([UserNum]) REFERENCES [userod] ([UserNum]);
GO

ALTER TABLE [emailattach] ADD CONSTRAINT [fk_emailattach_1_EmailMessageNum] FOREIGN KEY ([EmailMessageNum]) REFERENCES [emailmessage] ([EmailMessageNum]);
GO

ALTER TABLE [emailattach] ADD CONSTRAINT [fk_emailattach_2_EmailTemplateNum] FOREIGN KEY ([EmailTemplateNum]) REFERENCES [emailtemplate] ([EmailTemplateNum]);
GO

ALTER TABLE [emailhostingtemplate] ADD CONSTRAINT [fk_emailhostingtemplate_1_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [clinic] ([ClinicNum]);
GO

ALTER TABLE [emailmessage] ADD CONSTRAINT [fk_emailmessage_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [patient] ([PatNum]);
GO

ALTER TABLE [emailmessage] ADD CONSTRAINT [fk_emailmessage_2_ProvNumWebMail] FOREIGN KEY ([ProvNumWebMail]) REFERENCES [provider] ([ProvNum]);
GO

ALTER TABLE [emailmessage] ADD CONSTRAINT [fk_emailmessage_3_PatNumSubj] FOREIGN KEY ([PatNumSubj]) REFERENCES [patient] ([PatNum]);
GO

ALTER TABLE [emailmessage] ADD CONSTRAINT [fk_emailmessage_4_AptNum] FOREIGN KEY ([AptNum]) REFERENCES [appointment] ([AptNum]);
GO

ALTER TABLE [emailmessage] ADD CONSTRAINT [fk_emailmessage_5_UserNum] FOREIGN KEY ([UserNum]) REFERENCES [userod] ([UserNum]);
GO

ALTER TABLE [emailsecure] ADD CONSTRAINT [fk_emailsecure_1_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [clinic] ([ClinicNum]);
GO

ALTER TABLE [emailsecure] ADD CONSTRAINT [fk_emailsecure_2_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [patient] ([PatNum]);
GO

ALTER TABLE [emailsecure] ADD CONSTRAINT [fk_emailsecure_3_EmailMessageNum] FOREIGN KEY ([EmailMessageNum]) REFERENCES [emailmessage] ([EmailMessageNum]);
GO

ALTER TABLE [emailsecureattach] ADD CONSTRAINT [fk_emailsecureattach_1_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [clinic] ([ClinicNum]);
GO

ALTER TABLE [emailsecureattach] ADD CONSTRAINT [fk_emailsecureattach_2_EmailAttachNum] FOREIGN KEY ([EmailAttachNum]) REFERENCES [emailattach] ([EmailAttachNum]);
GO

ALTER TABLE [emailsecureattach] ADD CONSTRAINT [fk_emailsecureattach_3_EmailSecureNum] FOREIGN KEY ([EmailSecureNum]) REFERENCES [emailsecure] ([EmailSecureNum]);
GO

ALTER TABLE [encounter] ADD CONSTRAINT [fk_encounter_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [patient] ([PatNum]);
GO

ALTER TABLE [encounter] ADD CONSTRAINT [fk_encounter_2_ProvNum] FOREIGN KEY ([ProvNum]) REFERENCES [provider] ([ProvNum]);
GO

ALTER TABLE [encounter] ADD CONSTRAINT [fk_encounter_3_CodeValue] FOREIGN KEY ([CodeValue]) REFERENCES [ehrcode] ([CodeValue]);
GO

ALTER TABLE [encounter] ADD CONSTRAINT [fk_encounter_4_CodeSystem] FOREIGN KEY ([CodeSystem]) REFERENCES [codesystem] ([CodeSystemName]);
GO

ALTER TABLE [entrylog] ADD CONSTRAINT [fk_entrylog_1_UserNum] FOREIGN KEY ([UserNum]) REFERENCES [userod] ([UserNum]);
GO

ALTER TABLE [eobattach] ADD CONSTRAINT [fk_eobattach_1_ClaimPaymentNum] FOREIGN KEY ([ClaimPaymentNum]) REFERENCES [claimpayment] ([ClaimPaymentNum]);
GO

ALTER TABLE [eobattach] ADD CONSTRAINT [fk_eobattach_2_ClaimNumPreAuth] FOREIGN KEY ([ClaimNumPreAuth]) REFERENCES [claim] ([ClaimNum]);
GO

ALTER TABLE [equipment] ADD CONSTRAINT [fk_equipment_1_ProvNumCheckedOut] FOREIGN KEY ([ProvNumCheckedOut]) REFERENCES [provider] ([ProvNum]);
GO

ALTER TABLE [erouting] ADD CONSTRAINT [fk_erouting_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [patient] ([PatNum]);
GO

ALTER TABLE [erouting] ADD CONSTRAINT [fk_erouting_2_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [clinic] ([ClinicNum]);
GO

ALTER TABLE [eroutingaction] ADD CONSTRAINT [fk_eroutingaction_1_ERoutingNum] FOREIGN KEY ([ERoutingNum]) REFERENCES [erouting] ([ERoutingNum]);
GO

ALTER TABLE [eroutingaction] ADD CONSTRAINT [fk_eroutingaction_2_UserNum] FOREIGN KEY ([UserNum]) REFERENCES [userod] ([UserNum]);
GO

ALTER TABLE [eroutingactiondef] ADD CONSTRAINT [fk_eroutingactiondef_1_ERoutingDefNum] FOREIGN KEY ([ERoutingDefNum]) REFERENCES [eroutingdef] ([ERoutingDefNum]);
GO

ALTER TABLE [eroutingdef] ADD CONSTRAINT [fk_eroutingdef_1_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [clinic] ([ClinicNum]);
GO

ALTER TABLE [eroutingdef] ADD CONSTRAINT [fk_eroutingdef_2_UserNumCreated] FOREIGN KEY ([UserNumCreated]) REFERENCES [userod] ([UserNum]);
GO

ALTER TABLE [eroutingdef] ADD CONSTRAINT [fk_eroutingdef_3_UserNumModified] FOREIGN KEY ([UserNumModified]) REFERENCES [userod] ([UserNum]);
GO

ALTER TABLE [eroutingdeflink] ADD CONSTRAINT [fk_eroutingdeflink_1_ERoutingDefNum] FOREIGN KEY ([ERoutingDefNum]) REFERENCES [eroutingdef] ([eRoutingDefNum]);
GO

ALTER TABLE [erxlog] ADD CONSTRAINT [fk_erxlog_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [patient] ([PatNum]);
GO

ALTER TABLE [erxlog] ADD CONSTRAINT [fk_erxlog_2_ProvNum] FOREIGN KEY ([ProvNum]) REFERENCES [provider] ([ProvNum]);
GO

ALTER TABLE [erxlog] ADD CONSTRAINT [fk_erxlog_3_UserNum] FOREIGN KEY ([UserNum]) REFERENCES [userod] ([UserNum]);
GO

ALTER TABLE [eservicelog] ADD CONSTRAINT [fk_eservicelog_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [patient] ([PatNum]);
GO

ALTER TABLE [etrans] ADD CONSTRAINT [fk_etrans_1_ClearingHouseNum] FOREIGN KEY ([ClearingHouseNum]) REFERENCES [clearinghouse] ([ClearinghouseNum]);
GO

ALTER TABLE [etrans] ADD CONSTRAINT [fk_etrans_2_ClaimNum] FOREIGN KEY ([ClaimNum]) REFERENCES [claim] ([ClaimNum]);
GO

ALTER TABLE [etrans] ADD CONSTRAINT [fk_etrans_3_CarrierNum] FOREIGN KEY ([CarrierNum]) REFERENCES [carrier] ([CarrierNum]);
GO

ALTER TABLE [etrans] ADD CONSTRAINT [fk_etrans_4_CarrierNum2] FOREIGN KEY ([CarrierNum2]) REFERENCES [carrier] ([CarrierNum]);
GO

ALTER TABLE [etrans] ADD CONSTRAINT [fk_etrans_5_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [patient] ([PatNum]);
GO

ALTER TABLE [etrans] ADD CONSTRAINT [fk_etrans_6_EtransMessageTextNum] FOREIGN KEY ([EtransMessageTextNum]) REFERENCES [etransmessagetext] ([EtransMessageTextNum]);
GO

ALTER TABLE [etrans] ADD CONSTRAINT [fk_etrans_7_AckEtransNum] FOREIGN KEY ([AckEtransNum]) REFERENCES [etrans] ([EtransNum]);
GO

ALTER TABLE [etrans] ADD CONSTRAINT [fk_etrans_8_PlanNum] FOREIGN KEY ([PlanNum]) REFERENCES [insplan] ([PlanNum]);
GO

ALTER TABLE [etrans] ADD CONSTRAINT [fk_etrans_9_InsSubNum] FOREIGN KEY ([InsSubNum]) REFERENCES [inssub] ([InsSubNum]);
GO

ALTER TABLE [etrans] ADD CONSTRAINT [fk_etrans_10_UserNum] FOREIGN KEY ([UserNum]) REFERENCES [userod] ([UserNum]);
GO

ALTER TABLE [etrans835] ADD CONSTRAINT [fk_etrans835_1_EtransNum] FOREIGN KEY ([EtransNum]) REFERENCES [etrans] ([EtransNum]);
GO

ALTER TABLE [etrans835attach] ADD CONSTRAINT [fk_etrans835attach_1_EtransNum] FOREIGN KEY ([EtransNum]) REFERENCES [etrans] ([EtransNum]);
GO

ALTER TABLE [etrans835attach] ADD CONSTRAINT [fk_etrans835attach_2_ClaimNum] FOREIGN KEY ([ClaimNum]) REFERENCES [claim] ([ClaimNum]);
GO

ALTER TABLE [evaluation] ADD CONSTRAINT [fk_evaluation_1_InstructNum] FOREIGN KEY ([InstructNum]) REFERENCES [provider] ([ProvNum]);
GO

ALTER TABLE [evaluation] ADD CONSTRAINT [fk_evaluation_2_StudentNum] FOREIGN KEY ([StudentNum]) REFERENCES [provider] ([ProvNum]);
GO

ALTER TABLE [evaluation] ADD CONSTRAINT [fk_evaluation_3_SchoolCourseNum] FOREIGN KEY ([SchoolCourseNum]) REFERENCES [schoolcourse] ([SchoolCourseNum]);
GO

ALTER TABLE [evaluationcriterion] ADD CONSTRAINT [fk_evaluationcriterion_1_EvaluationNum] FOREIGN KEY ([EvaluationNum]) REFERENCES [evaluation] ([EvaluationNum]);
GO

ALTER TABLE [famaging] ADD CONSTRAINT [fk_famaging_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [patient] ([PatNum]);
GO

ALTER TABLE [familyhealth] ADD CONSTRAINT [fk_familyhealth_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [patient] ([PatNum]);
GO

ALTER TABLE [familyhealth] ADD CONSTRAINT [fk_familyhealth_2_DiseaseDefNum] FOREIGN KEY ([DiseaseDefNum]) REFERENCES [diseasedef] ([DiseaseDefNum]);
GO

ALTER TABLE [fee] ADD CONSTRAINT [fk_fee_1_FeeSched] FOREIGN KEY ([FeeSched]) REFERENCES [feesched] ([FeeSchedNum]);
GO

ALTER TABLE [fee] ADD CONSTRAINT [fk_fee_2_CodeNum] FOREIGN KEY ([CodeNum]) REFERENCES [procedurecode] ([CodeNum]);
GO

ALTER TABLE [fee] ADD CONSTRAINT [fk_fee_3_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [clinic] ([ClinicNum]);
GO

ALTER TABLE [fee] ADD CONSTRAINT [fk_fee_4_ProvNum] FOREIGN KEY ([ProvNum]) REFERENCES [provider] ([ProvNum]);
GO

ALTER TABLE [fee] ADD CONSTRAINT [fk_fee_5_SecUserNumEntry] FOREIGN KEY ([SecUserNumEntry]) REFERENCES [userod] ([UserNum]);
GO

ALTER TABLE [feesched] ADD CONSTRAINT [fk_feesched_1_SecUserNumEntry] FOREIGN KEY ([SecUserNumEntry]) REFERENCES [userod] ([UserNum]);
GO

ALTER TABLE [feeschedgroup] ADD CONSTRAINT [fk_feeschedgroup_1_FeeSchedNum] FOREIGN KEY ([FeeSchedNum]) REFERENCES [feesched] ([FeeSchedNum]);
GO

ALTER TABLE [feeschednote] ADD CONSTRAINT [fk_feeschednote_1_FeeSchedNum] FOREIGN KEY ([FeeSchedNum]) REFERENCES [feesched] ([FeeSchedNum]);
GO

ALTER TABLE [feeschednote] ADD CONSTRAINT [fk_feeschednote_2_SecUserNumEntry] FOREIGN KEY ([SecUserNumEntry]) REFERENCES [userod] ([UserNum]);
GO

ALTER TABLE [formpat] ADD CONSTRAINT [fk_formpat_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [patient] ([PatNum]);
GO

ALTER TABLE [guardian] ADD CONSTRAINT [fk_guardian_1_PatNumChild] FOREIGN KEY ([PatNumChild]) REFERENCES [patient] ([PatNum]);
GO

ALTER TABLE [guardian] ADD CONSTRAINT [fk_guardian_2_PatNumGuardian] FOREIGN KEY ([PatNumGuardian]) REFERENCES [patient] ([PatNum]);
GO

ALTER TABLE [hieclinic] ADD CONSTRAINT [fk_hieclinic_1_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [clinic] ([ClinicNum]);
GO

ALTER TABLE [hiequeue] ADD CONSTRAINT [fk_hiequeue_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [patient] ([PatNum]);
GO

ALTER TABLE [histappointment] ADD CONSTRAINT [fk_histappointment_1_HistUserNum] FOREIGN KEY ([HistUserNum]) REFERENCES [userod] ([UserNum]);
GO

ALTER TABLE [hl7msg] ADD CONSTRAINT [fk_hl7msg_1_AptNum] FOREIGN KEY ([AptNum]) REFERENCES [appointment] ([AptNum]);
GO

ALTER TABLE [hl7msg] ADD CONSTRAINT [fk_hl7msg_2_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [patient] ([PatNum]);
GO

ALTER TABLE [hl7procattach] ADD CONSTRAINT [fk_hl7procattach_1_HL7MsgNum] FOREIGN KEY ([HL7MsgNum]) REFERENCES [hl7msg] ([HL7MsgNum]);
GO

ALTER TABLE [hl7procattach] ADD CONSTRAINT [fk_hl7procattach_2_ProcNum] FOREIGN KEY ([ProcNum]) REFERENCES [procedurelog] ([ProcNum]);
GO

ALTER TABLE [imagedraw] ADD CONSTRAINT [fk_imagedraw_1_DocNum] FOREIGN KEY ([DocNum]) REFERENCES [document] ([DocNum]);
GO

ALTER TABLE [imagedraw] ADD CONSTRAINT [fk_imagedraw_2_MountNum] FOREIGN KEY ([MountNum]) REFERENCES [mount] ([MountNum]);
GO

ALTER TABLE [insbluebook] ADD CONSTRAINT [fk_insbluebook_1_ProcCodeNum] FOREIGN KEY ([ProcCodeNum]) REFERENCES [procedurecode] ([CodeNum]);
GO

ALTER TABLE [insbluebook] ADD CONSTRAINT [fk_insbluebook_2_CarrierNum] FOREIGN KEY ([CarrierNum]) REFERENCES [carrier] ([CarrierNum]);
GO

ALTER TABLE [insbluebook] ADD CONSTRAINT [fk_insbluebook_3_PlanNum] FOREIGN KEY ([PlanNum]) REFERENCES [insplan] ([PlanNum]);
GO

ALTER TABLE [insbluebook] ADD CONSTRAINT [fk_insbluebook_4_ProcNum] FOREIGN KEY ([ProcNum]) REFERENCES [procedurelog] ([ProcNum]);
GO

ALTER TABLE [insbluebook] ADD CONSTRAINT [fk_insbluebook_5_ClaimNum] FOREIGN KEY ([ClaimNum]) REFERENCES [claim] ([ClaimNum]);
GO

ALTER TABLE [insbluebooklog] ADD CONSTRAINT [fk_insbluebooklog_1_ClaimProcNum] FOREIGN KEY ([ClaimProcNum]) REFERENCES [claimproc] ([ClaimProcNum]);
GO

ALTER TABLE [inseditlog] ADD CONSTRAINT [fk_inseditlog_1_UserNum] FOREIGN KEY ([UserNum]) REFERENCES [userod] ([UserNum]);
GO

ALTER TABLE [inseditpatlog] ADD CONSTRAINT [fk_inseditpatlog_1_UserNum] FOREIGN KEY ([UserNum]) REFERENCES [userod] ([UserNum]);
GO

ALTER TABLE [inspending] ADD CONSTRAINT [fk_inspending_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [patient] ([PatNum]);
GO

ALTER TABLE [inspending] ADD CONSTRAINT [fk_inspending_2_PatNumSubscriber] FOREIGN KEY ([PatNumSubscriber]) REFERENCES [patient] ([PatNum]);
GO

ALTER TABLE [insplan] ADD CONSTRAINT [fk_insplan_1_FeeSched] FOREIGN KEY ([FeeSched]) REFERENCES [feesched] ([FeeSchedNum]);
GO

ALTER TABLE [insplan] ADD CONSTRAINT [fk_insplan_2_ClaimFormNum] FOREIGN KEY ([ClaimFormNum]) REFERENCES [claimform] ([ClaimFormNum]);
GO

ALTER TABLE [insplan] ADD CONSTRAINT [fk_insplan_3_CopayFeeSched] FOREIGN KEY ([CopayFeeSched]) REFERENCES [feesched] ([FeeSchedNum]);
GO

ALTER TABLE [insplan] ADD CONSTRAINT [fk_insplan_4_EmployerNum] FOREIGN KEY ([EmployerNum]) REFERENCES [employer] ([EmployerNum]);
GO

ALTER TABLE [insplan] ADD CONSTRAINT [fk_insplan_5_CarrierNum] FOREIGN KEY ([CarrierNum]) REFERENCES [carrier] ([CarrierNum]);
GO

ALTER TABLE [insplan] ADD CONSTRAINT [fk_insplan_6_AllowedFeeSched] FOREIGN KEY ([AllowedFeeSched]) REFERENCES [feesched] ([FeeSchedNum]);
GO

ALTER TABLE [insplan] ADD CONSTRAINT [fk_insplan_7_FilingCode] FOREIGN KEY ([FilingCode]) REFERENCES [insfilingcode] ([InsFilingCodeNum]);
GO

ALTER TABLE [insplan] ADD CONSTRAINT [fk_insplan_8_FilingCodeSubtype] FOREIGN KEY ([FilingCodeSubtype]) REFERENCES [insfilingcodesubtype] ([InsFilingCodeSubtypeNum]);
GO

ALTER TABLE [insplan] ADD CONSTRAINT [fk_insplan_9_SopCode] FOREIGN KEY ([SopCode]) REFERENCES [sop] ([SopCode]);
GO

ALTER TABLE [insplan] ADD CONSTRAINT [fk_insplan_10_SecUserNumEntry] FOREIGN KEY ([SecUserNumEntry]) REFERENCES [userod] ([UserNum]);
GO

ALTER TABLE [insplan] ADD CONSTRAINT [fk_insplan_11_BillingType] FOREIGN KEY ([BillingType]) REFERENCES [definition] ([DefNum]);
GO

ALTER TABLE [insplan] ADD CONSTRAINT [fk_insplan_12_ManualFeeSchedNum] FOREIGN KEY ([ManualFeeSchedNum]) REFERENCES [feesched] ([FeeSchedNum]);
GO

ALTER TABLE [insplanpreference] ADD CONSTRAINT [fk_insplanpreference_1_PlanNum] FOREIGN KEY ([PlanNum]) REFERENCES [insplan] ([PlanNum]);
GO

ALTER TABLE [inssub] ADD CONSTRAINT [fk_inssub_1_PlanNum] FOREIGN KEY ([PlanNum]) REFERENCES [insplan] ([PlanNum]);
GO

ALTER TABLE [inssub] ADD CONSTRAINT [fk_inssub_2_Subscriber] FOREIGN KEY ([Subscriber]) REFERENCES [patient] ([PatNum]);
GO

ALTER TABLE [inssub] ADD CONSTRAINT [fk_inssub_3_SecUserNumEntry] FOREIGN KEY ([SecUserNumEntry]) REFERENCES [userod] ([UserNum]);
GO

ALTER TABLE [installmentplan] ADD CONSTRAINT [fk_installmentplan_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [patient] ([PatNum]);
GO

ALTER TABLE [insverify] ADD CONSTRAINT [fk_insverify_1_UserNum] FOREIGN KEY ([UserNum]) REFERENCES [userod] ([UserNum]);
GO

ALTER TABLE [insverify] ADD CONSTRAINT [fk_insverify_2_DefNum] FOREIGN KEY ([DefNum]) REFERENCES [definition] ([DefNum]);
GO

ALTER TABLE [insverifyhist] ADD CONSTRAINT [fk_insverifyhist_1_VerifyUserNum] FOREIGN KEY ([VerifyUserNum]) REFERENCES [userod] ([UserNum]);
GO

ALTER TABLE [intervention] ADD CONSTRAINT [fk_intervention_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [patient] ([PatNum]);
GO

ALTER TABLE [intervention] ADD CONSTRAINT [fk_intervention_2_ProvNum] FOREIGN KEY ([ProvNum]) REFERENCES [provider] ([ProvNum]);
GO

ALTER TABLE [intervention] ADD CONSTRAINT [fk_intervention_3_CodeValue] FOREIGN KEY ([CodeValue]) REFERENCES [ehrcode] ([CodeValue]);
GO

ALTER TABLE [intervention] ADD CONSTRAINT [fk_intervention_4_CodeSystem] FOREIGN KEY ([CodeSystem]) REFERENCES [codesystem] ([CodeSystemName]);
GO

ALTER TABLE [journalentry] ADD CONSTRAINT [fk_journalentry_1_TransactionNum] FOREIGN KEY ([TransactionNum]) REFERENCES [transaction] ([TransactionNum]);
GO

ALTER TABLE [journalentry] ADD CONSTRAINT [fk_journalentry_2_AccountNum] FOREIGN KEY ([AccountNum]) REFERENCES [account] ([AccountNum]);
GO

ALTER TABLE [journalentry] ADD CONSTRAINT [fk_journalentry_3_ReconcileNum] FOREIGN KEY ([ReconcileNum]) REFERENCES [reconcile] ([ReconcileNum]);
GO

ALTER TABLE [journalentry] ADD CONSTRAINT [fk_journalentry_4_SecUserNumEntry] FOREIGN KEY ([SecUserNumEntry]) REFERENCES [userod] ([UserNum]);
GO

ALTER TABLE [journalentry] ADD CONSTRAINT [fk_journalentry_5_SecUserNumEdit] FOREIGN KEY ([SecUserNumEdit]) REFERENCES [userod] ([UserNum]);
GO

ALTER TABLE [labcase] ADD CONSTRAINT [fk_labcase_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [patient] ([PatNum]);
GO

ALTER TABLE [labcase] ADD CONSTRAINT [fk_labcase_2_LaboratoryNum] FOREIGN KEY ([LaboratoryNum]) REFERENCES [laboratory] ([LaboratoryNum]);
GO

ALTER TABLE [labcase] ADD CONSTRAINT [fk_labcase_3_AptNum] FOREIGN KEY ([AptNum]) REFERENCES [appointment] ([AptNum]);
GO

ALTER TABLE [labcase] ADD CONSTRAINT [fk_labcase_4_PlannedAptNum] FOREIGN KEY ([PlannedAptNum]) REFERENCES [appointment] ([AptNum]);
GO

ALTER TABLE [labcase] ADD CONSTRAINT [fk_labcase_5_ProvNum] FOREIGN KEY ([ProvNum]) REFERENCES [provider] ([ProvNum]);
GO

ALTER TABLE [labpanel] ADD CONSTRAINT [fk_labpanel_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [patient] ([PatNum]);
GO

ALTER TABLE [labpanel] ADD CONSTRAINT [fk_labpanel_2_MedicalOrderNum] FOREIGN KEY ([MedicalOrderNum]) REFERENCES [medicalorder] ([MedicalOrderNum]);
GO

ALTER TABLE [labresult] ADD CONSTRAINT [fk_labresult_1_LabPanelNum] FOREIGN KEY ([LabPanelNum]) REFERENCES [labpanel] ([LabPanelNum]);
GO

ALTER TABLE [labresult] ADD CONSTRAINT [fk_labresult_2_ObsUnits] FOREIGN KEY ([ObsUnits]) REFERENCES [drugunit] ([UnitText]);
GO

ALTER TABLE [medicalorder] ADD CONSTRAINT [fk_medicalorder_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [patient] ([PatNum]);
GO

ALTER TABLE [medicalorder] ADD CONSTRAINT [fk_medicalorder_2_ProvNum] FOREIGN KEY ([ProvNum]) REFERENCES [provider] ([ProvNum]);
GO

ALTER TABLE [medicationpat] ADD CONSTRAINT [fk_medicationpat_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [patient] ([PatNum]);
GO

ALTER TABLE [medicationpat] ADD CONSTRAINT [fk_medicationpat_2_MedicationNum] FOREIGN KEY ([MedicationNum]) REFERENCES [medication] ([MedicationNum]);
GO

ALTER TABLE [medicationpat] ADD CONSTRAINT [fk_medicationpat_3_ProvNum] FOREIGN KEY ([ProvNum]) REFERENCES [provider] ([ProvNum]);
GO

ALTER TABLE [medlab] ADD CONSTRAINT [fk_medlab_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [patient] ([PatNum]);
GO

ALTER TABLE [medlab] ADD CONSTRAINT [fk_medlab_2_ProvNum] FOREIGN KEY ([ProvNum]) REFERENCES [provider] ([ProvNum]);
GO

ALTER TABLE [medlabfacattach] ADD CONSTRAINT [fk_medlabfacattach_1_MedLabNum] FOREIGN KEY ([MedLabNum]) REFERENCES [medlab] ([MedLabNum]);
GO

ALTER TABLE [medlabfacattach] ADD CONSTRAINT [fk_medlabfacattach_2_MedLabResultNum] FOREIGN KEY ([MedLabResultNum]) REFERENCES [medlabresult] ([MedLabResultNum]);
GO

ALTER TABLE [medlabfacattach] ADD CONSTRAINT [fk_medlabfacattach_3_MedLabFacilityNum] FOREIGN KEY ([MedLabFacilityNum]) REFERENCES [medlabfacility] ([MedLabFacilityNum]);
GO

ALTER TABLE [medlabresult] ADD CONSTRAINT [fk_medlabresult_1_MedLabNum] FOREIGN KEY ([MedLabNum]) REFERENCES [medlab] ([medLabNum]);
GO

ALTER TABLE [medlabresult] ADD CONSTRAINT [fk_medlabresult_2_DocNum] FOREIGN KEY ([DocNum]) REFERENCES [document] ([DocNum]);
GO

ALTER TABLE [medlabspecimen] ADD CONSTRAINT [fk_medlabspecimen_1_MedLabNum] FOREIGN KEY ([MedLabNum]) REFERENCES [medlab] ([MedLabNum]);
GO

ALTER TABLE [mobileappdevice] ADD CONSTRAINT [fk_mobileappdevice_1_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [clinic] ([ClinicNum]);
GO

ALTER TABLE [mobileappdevice] ADD CONSTRAINT [fk_mobileappdevice_2_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [patient] ([PatNum]);
GO

ALTER TABLE [mobileappdevice] ADD CONSTRAINT [fk_mobileappdevice_3_UserNum] FOREIGN KEY ([UserNum]) REFERENCES [userod] ([UserNum]);
GO

ALTER TABLE [mobilebrandingprofile] ADD CONSTRAINT [fk_mobilebrandingprofile_1_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [clinic] ([ClinicNum]);
GO

ALTER TABLE [mount] ADD CONSTRAINT [fk_mount_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [patient] ([PatNum]);
GO

ALTER TABLE [mount] ADD CONSTRAINT [fk_mount_2_DocCategory] FOREIGN KEY ([DocCategory]) REFERENCES [definition] ([DefNum]);
GO

ALTER TABLE [mount] ADD CONSTRAINT [fk_mount_3_ProvNum] FOREIGN KEY ([ProvNum]) REFERENCES [provider] ([ProvNum]);
GO

ALTER TABLE [mountitem] ADD CONSTRAINT [fk_mountitem_1_MountNum] FOREIGN KEY ([MountNum]) REFERENCES [mount] ([MountNum]);
GO

ALTER TABLE [msgtopaysent] ADD CONSTRAINT [fk_msgtopaysent_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [patient] ([PatNum]);
GO

ALTER TABLE [msgtopaysent] ADD CONSTRAINT [fk_msgtopaysent_2_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [clinic] ([ClinicNum]);
GO

ALTER TABLE [msgtopaysent] ADD CONSTRAINT [fk_msgtopaysent_3_ApptReminderRuleNum] FOREIGN KEY ([ApptReminderRuleNum]) REFERENCES [apptreminderrule] ([ApptReminderRuleNum]);
GO

ALTER TABLE [msgtopaysent] ADD CONSTRAINT [fk_msgtopaysent_4_ApptNum] FOREIGN KEY ([ApptNum]) REFERENCES [appointment] ([AptNum]);
GO

ALTER TABLE [msgtopaysent] ADD CONSTRAINT [fk_msgtopaysent_5_StatementNum] FOREIGN KEY ([StatementNum]) REFERENCES [statement] ([StatementNum]);
GO

ALTER TABLE [oidexternal] ADD CONSTRAINT [fk_oidexternal_1_IDInternal] FOREIGN KEY ([IDInternal]) REFERENCES [patient] ([Patnum]);
GO

ALTER TABLE [operatory] ADD CONSTRAINT [fk_operatory_1_ProvDentist] FOREIGN KEY ([ProvDentist]) REFERENCES [provider] ([ProvNum]);
GO

ALTER TABLE [operatory] ADD CONSTRAINT [fk_operatory_2_ProvHygienist] FOREIGN KEY ([ProvHygienist]) REFERENCES [provider] ([ProvNum]);
GO

ALTER TABLE [operatory] ADD CONSTRAINT [fk_operatory_3_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [clinic] ([ClinicNum]);
GO

ALTER TABLE [operatory] ADD CONSTRAINT [fk_operatory_4_OperatoryType] FOREIGN KEY ([OperatoryType]) REFERENCES [definition] ([DefNum]);
GO

ALTER TABLE [orthocase] ADD CONSTRAINT [fk_orthocase_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [patient] ([PatNum]);
GO

ALTER TABLE [orthocase] ADD CONSTRAINT [fk_orthocase_2_ProvNum] FOREIGN KEY ([ProvNum]) REFERENCES [provider] ([ProvNum]);
GO

ALTER TABLE [orthocase] ADD CONSTRAINT [fk_orthocase_3_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [clinic] ([ClinicNum]);
GO

ALTER TABLE [orthocase] ADD CONSTRAINT [fk_orthocase_4_OrthoType] FOREIGN KEY ([OrthoType]) REFERENCES [definition] ([DefNum]);
GO

ALTER TABLE [orthocase] ADD CONSTRAINT [fk_orthocase_5_SecUserNumEntry] FOREIGN KEY ([SecUserNumEntry]) REFERENCES [userod] ([usernum]);
GO

ALTER TABLE [orthochart] ADD CONSTRAINT [fk_orthochart_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [patient] ([PatNum]);
GO

ALTER TABLE [orthochart] ADD CONSTRAINT [fk_orthochart_2_UserNum] FOREIGN KEY ([UserNum]) REFERENCES [userod] ([UserNum]);
GO

ALTER TABLE [orthochart] ADD CONSTRAINT [fk_orthochart_3_ProvNum] FOREIGN KEY ([ProvNum]) REFERENCES [provider] ([ProvNum]);
GO

ALTER TABLE [orthochart] ADD CONSTRAINT [fk_orthochart_4_OrthoChartRowNum] FOREIGN KEY ([OrthoChartRowNum]) REFERENCES [orthochartrow] ([OrthoChartRowNum]);
GO

ALTER TABLE [orthochartlog] ADD CONSTRAINT [fk_orthochartlog_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [patient] ([PatNum]);
GO

ALTER TABLE [orthochartlog] ADD CONSTRAINT [fk_orthochartlog_2_UserNum] FOREIGN KEY ([UserNum]) REFERENCES [userod] ([UserNum]);
GO

ALTER TABLE [orthochartlog] ADD CONSTRAINT [fk_orthochartlog_3_ProvNum] FOREIGN KEY ([ProvNum]) REFERENCES [provider] ([ProvNum]);
GO

ALTER TABLE [orthochartlog] ADD CONSTRAINT [fk_orthochartlog_4_OrthoChartRowNum] FOREIGN KEY ([OrthoChartRowNum]) REFERENCES [orthochartrow] ([OrthoChartRowNum]);
GO

ALTER TABLE [orthochartrow] ADD CONSTRAINT [fk_orthochartrow_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [patient] ([PatNum]);
GO

ALTER TABLE [orthochartrow] ADD CONSTRAINT [fk_orthochartrow_2_UserNum] FOREIGN KEY ([UserNum]) REFERENCES [userod] ([UserNum]);
GO

ALTER TABLE [orthochartrow] ADD CONSTRAINT [fk_orthochartrow_3_ProvNum] FOREIGN KEY ([ProvNum]) REFERENCES [provider] ([ProvNum]);
GO

ALTER TABLE [orthohardware] ADD CONSTRAINT [fk_orthohardware_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [patient] ([PatNum]);
GO

ALTER TABLE [orthohardware] ADD CONSTRAINT [fk_orthohardware_2_OrthoHardwareSpecNum] FOREIGN KEY ([OrthoHardwareSpecNum]) REFERENCES [orthohardwarespec] ([OrthoHardwareSpecNum]);
GO

ALTER TABLE [orthoplanlink] ADD CONSTRAINT [fk_orthoplanlink_1_OrthoCaseNum] FOREIGN KEY ([OrthoCaseNum]) REFERENCES [orthocase] ([OrthoCaseNum]);
GO

ALTER TABLE [orthoplanlink] ADD CONSTRAINT [fk_orthoplanlink_2_SecUserNumEntry] FOREIGN KEY ([SecUserNumEntry]) REFERENCES [userod] ([UserNum]);
GO

ALTER TABLE [orthoproclink] ADD CONSTRAINT [fk_orthoproclink_1_OrthoCaseNum] FOREIGN KEY ([OrthoCaseNum]) REFERENCES [orthocase] ([OrthoCaseNum]);
GO

ALTER TABLE [orthoproclink] ADD CONSTRAINT [fk_orthoproclink_2_ProcNum] FOREIGN KEY ([ProcNum]) REFERENCES [procedurelog] ([ProcNum]);
GO

ALTER TABLE [orthoproclink] ADD CONSTRAINT [fk_orthoproclink_3_SecUserNumEntry] FOREIGN KEY ([SecUserNumEntry]) REFERENCES [userod] ([UserNum]);
GO

ALTER TABLE [patfield] ADD CONSTRAINT [fk_patfield_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [patient] ([PatNum]);
GO

ALTER TABLE [patfield] ADD CONSTRAINT [fk_patfield_2_FieldName] FOREIGN KEY ([FieldName]) REFERENCES [patfielddef] ([FieldName]);
GO

ALTER TABLE [patfield] ADD CONSTRAINT [fk_patfield_3_SecUserNumEntry] FOREIGN KEY ([SecUserNumEntry]) REFERENCES [userod] ([UserNum]);
GO

ALTER TABLE [patient] ADD CONSTRAINT [fk_patient_1_Guarantor] FOREIGN KEY ([Guarantor]) REFERENCES [patient] ([PatNum]);
GO

ALTER TABLE [patient] ADD CONSTRAINT [fk_patient_2_PriProv] FOREIGN KEY ([PriProv]) REFERENCES [provider] ([ProvNum]);
GO

ALTER TABLE [patient] ADD CONSTRAINT [fk_patient_3_SecProv] FOREIGN KEY ([SecProv]) REFERENCES [provider] ([ProvNum]);
GO

ALTER TABLE [patient] ADD CONSTRAINT [fk_patient_4_FeeSched] FOREIGN KEY ([FeeSched]) REFERENCES [feesched] ([FeeSchedNum]);
GO

ALTER TABLE [patient] ADD CONSTRAINT [fk_patient_5_BillingType] FOREIGN KEY ([BillingType]) REFERENCES [definition] ([DefNum]);
GO

ALTER TABLE [patient] ADD CONSTRAINT [fk_patient_6_EmployerNum] FOREIGN KEY ([EmployerNum]) REFERENCES [employer] ([EmployerNum]);
GO

ALTER TABLE [patient] ADD CONSTRAINT [fk_patient_7_County] FOREIGN KEY ([County]) REFERENCES [county] ([CountyName]);
GO

ALTER TABLE [patient] ADD CONSTRAINT [fk_patient_8_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [clinic] ([ClinicNum]);
GO

ALTER TABLE [patient] ADD CONSTRAINT [fk_patient_9_SiteNum] FOREIGN KEY ([SiteNum]) REFERENCES [site] ([SiteNum]);
GO

ALTER TABLE [patient] ADD CONSTRAINT [fk_patient_10_ResponsParty] FOREIGN KEY ([ResponsParty]) REFERENCES [patient] ([PatNum]);
GO

ALTER TABLE [patient] ADD CONSTRAINT [fk_patient_11_SuperFamily] FOREIGN KEY ([SuperFamily]) REFERENCES [patient] ([PatNum]);
GO

ALTER TABLE [patient] ADD CONSTRAINT [fk_patient_12_SecUserNumEntry] FOREIGN KEY ([SecUserNumEntry]) REFERENCES [userod] ([UserNum]);
GO

ALTER TABLE [patient] ADD CONSTRAINT [fk_patient_13_DiscountPlanNum] FOREIGN KEY ([DiscountPlanNum]) REFERENCES [discountplan] ([DiscountPlanNum]);
GO

ALTER TABLE [patientlink] ADD CONSTRAINT [fk_patientlink_1_PatNumFrom] FOREIGN KEY ([PatNumFrom]) REFERENCES [patient] ([PatNum]);
GO

ALTER TABLE [patientlink] ADD CONSTRAINT [fk_patientlink_2_PatNumTo] FOREIGN KEY ([PatNumTo]) REFERENCES [patient] ([PatNum]);
GO

ALTER TABLE [patientnote] ADD CONSTRAINT [fk_patientnote_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [patient] ([PatNum]);
GO

ALTER TABLE [patientnote] ADD CONSTRAINT [fk_patientnote_2_UserNumOrthoLocked] FOREIGN KEY ([UserNumOrthoLocked]) REFERENCES [userod] ([UserNum]);
GO

ALTER TABLE [patientportalinvite] ADD CONSTRAINT [fk_patientportalinvite_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [patient] ([PatNum]);
GO

ALTER TABLE [patientportalinvite] ADD CONSTRAINT [fk_patientportalinvite_2_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [clinic] ([ClinicNum]);
GO

ALTER TABLE [patientportalinvite] ADD CONSTRAINT [fk_patientportalinvite_3_ApptReminderRuleNum] FOREIGN KEY ([ApptReminderRuleNum]) REFERENCES [apptreminderrule] ([ApptReminderRuleNum]);
GO

ALTER TABLE [patientrace] ADD CONSTRAINT [fk_patientrace_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [patient] ([PatNum]);
GO

ALTER TABLE [patientrace] ADD CONSTRAINT [fk_patientrace_2_CdcrecCode] FOREIGN KEY ([CdcrecCode]) REFERENCES [cdcrec] ([CdcrecCode]);
GO

ALTER TABLE [patplan] ADD CONSTRAINT [fk_patplan_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [patient] ([PatNum]);
GO

ALTER TABLE [patplan] ADD CONSTRAINT [fk_patplan_2_InsSubNum] FOREIGN KEY ([InsSubNum]) REFERENCES [inssub] ([InsSubNum]);
GO

ALTER TABLE [patrestriction] ADD CONSTRAINT [fk_patrestriction_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [patient] ([PatNum]);
GO

ALTER TABLE [payconnectresponseweb] ADD CONSTRAINT [fk_payconnectresponseweb_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [patient] ([PatNum]);
GO

ALTER TABLE [payconnectresponseweb] ADD CONSTRAINT [fk_payconnectresponseweb_2_PayNum] FOREIGN KEY ([PayNum]) REFERENCES [payment] ([PayNum]);
GO

ALTER TABLE [payment] ADD CONSTRAINT [fk_payment_1_PayType] FOREIGN KEY ([PayType]) REFERENCES [definition] ([DefNum]);
GO

ALTER TABLE [payment] ADD CONSTRAINT [fk_payment_2_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [patient] ([PatNum]);
GO

ALTER TABLE [payment] ADD CONSTRAINT [fk_payment_3_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [clinic] ([ClinicNum]);
GO

ALTER TABLE [payment] ADD CONSTRAINT [fk_payment_4_DepositNum] FOREIGN KEY ([DepositNum]) REFERENCES [deposit] ([DepositNum]);
GO

ALTER TABLE [payment] ADD CONSTRAINT [fk_payment_5_SecUserNumEntry] FOREIGN KEY ([SecUserNumEntry]) REFERENCES [userod] ([UserNum]);
GO

ALTER TABLE [payortype] ADD CONSTRAINT [fk_payortype_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [patient] ([PatNum]);
GO

ALTER TABLE [payortype] ADD CONSTRAINT [fk_payortype_2_SopCode] FOREIGN KEY ([SopCode]) REFERENCES [sop] ([SopCode]);
GO

ALTER TABLE [payplan] ADD CONSTRAINT [fk_payplan_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [patient] ([PatNum]);
GO

ALTER TABLE [payplan] ADD CONSTRAINT [fk_payplan_2_Guarantor] FOREIGN KEY ([Guarantor]) REFERENCES [patient] ([PatNum]);
GO

ALTER TABLE [payplan] ADD CONSTRAINT [fk_payplan_3_PlanNum] FOREIGN KEY ([PlanNum]) REFERENCES [insplan] ([PlanNum]);
GO

ALTER TABLE [payplan] ADD CONSTRAINT [fk_payplan_4_InsSubNum] FOREIGN KEY ([InsSubNum]) REFERENCES [inssub] ([InsSubNum]);
GO

ALTER TABLE [payplan] ADD CONSTRAINT [fk_payplan_5_PlanCategory] FOREIGN KEY ([PlanCategory]) REFERENCES [definition] ([DefNum]);
GO

ALTER TABLE [payplan] ADD CONSTRAINT [fk_payplan_6_SheetDefNum] FOREIGN KEY ([SheetDefNum]) REFERENCES [sheetdef] ([SheetDefNum]);
GO

ALTER TABLE [payplancharge] ADD CONSTRAINT [fk_payplancharge_1_PayPlanNum] FOREIGN KEY ([PayPlanNum]) REFERENCES [payplan] ([PayPlanNum]);
GO

ALTER TABLE [payplancharge] ADD CONSTRAINT [fk_payplancharge_2_Guarantor] FOREIGN KEY ([Guarantor]) REFERENCES [patient] ([PatNum]);
GO

ALTER TABLE [payplancharge] ADD CONSTRAINT [fk_payplancharge_3_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [patient] ([PatNum]);
GO

ALTER TABLE [payplancharge] ADD CONSTRAINT [fk_payplancharge_4_ProvNum] FOREIGN KEY ([ProvNum]) REFERENCES [provider] ([ProvNum]);
GO

ALTER TABLE [payplancharge] ADD CONSTRAINT [fk_payplancharge_5_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [clinic] ([ClinicNum]);
GO

ALTER TABLE [payplancharge] ADD CONSTRAINT [fk_payplancharge_6_ProcNum] FOREIGN KEY ([ProcNum]) REFERENCES [procedurelog] ([ProcNum]);
GO

ALTER TABLE [payplancharge] ADD CONSTRAINT [fk_payplancharge_7_StatementNum] FOREIGN KEY ([StatementNum]) REFERENCES [statement] ([StatementNum]);
GO

ALTER TABLE [payplanlink] ADD CONSTRAINT [fk_payplanlink_1_PayPlanNum] FOREIGN KEY ([PayPlanNum]) REFERENCES [payplan] ([PayPlanNum]);
GO

ALTER TABLE [payplantemplate] ADD CONSTRAINT [fk_payplantemplate_1_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [clinic] ([ClinicNum]);
GO

ALTER TABLE [payplantemplate] ADD CONSTRAINT [fk_payplantemplate_2_SheetDefNum] FOREIGN KEY ([SheetDefNum]) REFERENCES [sheetdef] ([SheetDefNum]);
GO

ALTER TABLE [paysplit] ADD CONSTRAINT [fk_paysplit_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [patient] ([PatNum]);
GO

ALTER TABLE [paysplit] ADD CONSTRAINT [fk_paysplit_2_PayNum] FOREIGN KEY ([PayNum]) REFERENCES [payment] ([PayNum]);
GO

ALTER TABLE [paysplit] ADD CONSTRAINT [fk_paysplit_3_ProvNum] FOREIGN KEY ([ProvNum]) REFERENCES [provider] ([ProvNum]);
GO

ALTER TABLE [paysplit] ADD CONSTRAINT [fk_paysplit_4_PayPlanNum] FOREIGN KEY ([PayPlanNum]) REFERENCES [payplan] ([PayPlanNum]);
GO

ALTER TABLE [paysplit] ADD CONSTRAINT [fk_paysplit_5_ProcNum] FOREIGN KEY ([ProcNum]) REFERENCES [procedurelog] ([ProcNum]);
GO

ALTER TABLE [paysplit] ADD CONSTRAINT [fk_paysplit_6_UnearnedType] FOREIGN KEY ([UnearnedType]) REFERENCES [definition] ([DefNum]);
GO

ALTER TABLE [paysplit] ADD CONSTRAINT [fk_paysplit_7_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [clinic] ([ClinicNum]);
GO

ALTER TABLE [paysplit] ADD CONSTRAINT [fk_paysplit_8_SecUserNumEntry] FOREIGN KEY ([SecUserNumEntry]) REFERENCES [userod] ([UserNum]);
GO

ALTER TABLE [paysplit] ADD CONSTRAINT [fk_paysplit_9_AdjNum] FOREIGN KEY ([AdjNum]) REFERENCES [adjustment] ([AdjNum]);
GO

ALTER TABLE [paysplit] ADD CONSTRAINT [fk_paysplit_10_PayPlanChargeNum] FOREIGN KEY ([PayPlanChargeNum]) REFERENCES [payplancharge] ([PayPlanChargeNum]);
GO

ALTER TABLE [paysuitepayment] ADD CONSTRAINT [fk_paysuitepayment_1_PaySuitePaymentDetailNum] FOREIGN KEY ([PaySuitePaymentDetailNum]) REFERENCES [paysuitepaymentdetail] ([PaySuitePaymentDetailNum]);
GO

ALTER TABLE [paysuitepayment] ADD CONSTRAINT [fk_paysuitepayment_2_ClaimPaymentNum] FOREIGN KEY ([ClaimPaymentNum]) REFERENCES [claimpayment] ([ClaimPaymentNum]);
GO

ALTER TABLE [payterminal] ADD CONSTRAINT [fk_payterminal_1_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [clinic] ([ClinicNum]);
GO

ALTER TABLE [pearlrequest] ADD CONSTRAINT [fk_pearlrequest_1_DocNum] FOREIGN KEY ([DocNum]) REFERENCES [document] ([DocNum]);
GO

ALTER TABLE [perioexam] ADD CONSTRAINT [fk_perioexam_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [patient] ([PatNum]);
GO

ALTER TABLE [perioexam] ADD CONSTRAINT [fk_perioexam_2_ProvNum] FOREIGN KEY ([ProvNum]) REFERENCES [provider] ([ProvNum]);
GO

ALTER TABLE [periomeasure] ADD CONSTRAINT [fk_periomeasure_1_PerioExamNum] FOREIGN KEY ([PerioExamNum]) REFERENCES [perioexam] ([PerioExamNum]);
GO

ALTER TABLE [pharmclinic] ADD CONSTRAINT [fk_pharmclinic_1_PharmacyNum] FOREIGN KEY ([PharmacyNum]) REFERENCES [pharmacy] ([PharmacyNum]);
GO

ALTER TABLE [pharmclinic] ADD CONSTRAINT [fk_pharmclinic_2_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [clinic] ([ClinicNum]);
GO

ALTER TABLE [phonenumber] ADD CONSTRAINT [fk_phonenumber_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [patient] ([PatNum]);
GO

ALTER TABLE [popup] ADD CONSTRAINT [fk_popup_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [patient] ([PatNum]);
GO

ALTER TABLE [popup] ADD CONSTRAINT [fk_popup_2_UserNum] FOREIGN KEY ([UserNum]) REFERENCES [userod] ([UserNum]);
GO

ALTER TABLE [procbuttonitem] ADD CONSTRAINT [fk_procbuttonitem_1_ProcButtonNum] FOREIGN KEY ([ProcButtonNum]) REFERENCES [procbutton] ([ProcButtonNum]);
GO

ALTER TABLE [procbuttonitem] ADD CONSTRAINT [fk_procbuttonitem_2_AutoCodeNum] FOREIGN KEY ([AutoCodeNum]) REFERENCES [autocode] ([AutoCodeNum]);
GO

ALTER TABLE [procbuttonitem] ADD CONSTRAINT [fk_procbuttonitem_3_CodeNum] FOREIGN KEY ([CodeNum]) REFERENCES [procedurecode] ([CodeNum]);
GO

ALTER TABLE [procbuttonquick] ADD CONSTRAINT [fk_procbuttonquick_1_CodeValue] FOREIGN KEY ([CodeValue]) REFERENCES [procedurecode] ([ProcCode]);
GO

ALTER TABLE [proccodenote] ADD CONSTRAINT [fk_proccodenote_1_CodeNum] FOREIGN KEY ([CodeNum]) REFERENCES [procedurecode] ([CodeNum]);
GO

ALTER TABLE [proccodenote] ADD CONSTRAINT [fk_proccodenote_2_ProvNum] FOREIGN KEY ([ProvNum]) REFERENCES [provider] ([ProvNum]);
GO

ALTER TABLE [procedurecode] ADD CONSTRAINT [fk_procedurecode_1_ProcCat] FOREIGN KEY ([ProcCat]) REFERENCES [definition] ([DefNum]);
GO

ALTER TABLE [procedurecode] ADD CONSTRAINT [fk_procedurecode_2_MedicalCode] FOREIGN KEY ([MedicalCode]) REFERENCES [procedurecode] ([ProcCode]);
GO

ALTER TABLE [procedurecode] ADD CONSTRAINT [fk_procedurecode_3_SubstitutionCode] FOREIGN KEY ([SubstitutionCode]) REFERENCES [procedurecode] ([ProcCode]);
GO

ALTER TABLE [procedurecode] ADD CONSTRAINT [fk_procedurecode_4_ProvNumDefault] FOREIGN KEY ([ProvNumDefault]) REFERENCES [provider] ([ProvNum]);
GO

ALTER TABLE [procedurelog] ADD CONSTRAINT [fk_procedurelog_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [patient] ([PatNum]);
GO

ALTER TABLE [procedurelog] ADD CONSTRAINT [fk_procedurelog_2_AptNum] FOREIGN KEY ([AptNum]) REFERENCES [appointment] ([AptNum]);
GO

ALTER TABLE [procedurelog] ADD CONSTRAINT [fk_procedurelog_3_Priority] FOREIGN KEY ([Priority]) REFERENCES [definition] ([DefNum]);
GO

ALTER TABLE [procedurelog] ADD CONSTRAINT [fk_procedurelog_4_ProvNum] FOREIGN KEY ([ProvNum]) REFERENCES [provider] ([ProvNum]);
GO

ALTER TABLE [procedurelog] ADD CONSTRAINT [fk_procedurelog_5_Dx] FOREIGN KEY ([Dx]) REFERENCES [definition] ([DefNum]);
GO

ALTER TABLE [procedurelog] ADD CONSTRAINT [fk_procedurelog_6_PlannedAptNum] FOREIGN KEY ([PlannedAptNum]) REFERENCES [appointment] ([AptNum]);
GO

ALTER TABLE [procedurelog] ADD CONSTRAINT [fk_procedurelog_7_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [clinic] ([ClinicNum]);
GO

ALTER TABLE [procedurelog] ADD CONSTRAINT [fk_procedurelog_8_MedicalCode] FOREIGN KEY ([MedicalCode]) REFERENCES [procedurecode] ([ProcCode]);
GO

ALTER TABLE [procedurelog] ADD CONSTRAINT [fk_procedurelog_9_ProcNumLab] FOREIGN KEY ([ProcNumLab]) REFERENCES [procedurelog] ([ProcNum]);
GO

ALTER TABLE [procedurelog] ADD CONSTRAINT [fk_procedurelog_10_BillingTypeOne] FOREIGN KEY ([BillingTypeOne]) REFERENCES [definition] ([DefNum]);
GO

ALTER TABLE [procedurelog] ADD CONSTRAINT [fk_procedurelog_11_BillingTypeTwo] FOREIGN KEY ([BillingTypeTwo]) REFERENCES [definition] ([DefNum]);
GO

ALTER TABLE [procedurelog] ADD CONSTRAINT [fk_procedurelog_12_CodeNum] FOREIGN KEY ([CodeNum]) REFERENCES [procedurecode] ([CodeNum]);
GO

ALTER TABLE [procedurelog] ADD CONSTRAINT [fk_procedurelog_13_SiteNum] FOREIGN KEY ([SiteNum]) REFERENCES [site] ([SiteNum]);
GO

ALTER TABLE [procedurelog] ADD CONSTRAINT [fk_procedurelog_14_Prognosis] FOREIGN KEY ([Prognosis]) REFERENCES [definition] ([DefNum]);
GO

ALTER TABLE [procedurelog] ADD CONSTRAINT [fk_procedurelog_15_StatementNum] FOREIGN KEY ([StatementNum]) REFERENCES [statement] ([StatementNum]);
GO

ALTER TABLE [procedurelog] ADD CONSTRAINT [fk_procedurelog_16_RepeatChargeNum] FOREIGN KEY ([RepeatChargeNum]) REFERENCES [repeatcharge] ([RepeatChargeNum]);
GO

ALTER TABLE [procedurelog] ADD CONSTRAINT [fk_procedurelog_17_ProvOrderOverride] FOREIGN KEY ([ProvOrderOverride]) REFERENCES [provider] ([ProvNum]);
GO

ALTER TABLE [procedurelog] ADD CONSTRAINT [fk_procedurelog_18_SecUserNumEntry] FOREIGN KEY ([SecUserNumEntry]) REFERENCES [userod] ([UserNum]);
GO

ALTER TABLE [procedurelog] ADD CONSTRAINT [fk_procedurelog_19_OrderingReferralNum] FOREIGN KEY ([OrderingReferralNum]) REFERENCES [referral] ([ReferralNum]);
GO

ALTER TABLE [procgroupitem] ADD CONSTRAINT [fk_procgroupitem_1_ProcNum] FOREIGN KEY ([ProcNum]) REFERENCES [procedurelog] ([ProcNum]);
GO

ALTER TABLE [procgroupitem] ADD CONSTRAINT [fk_procgroupitem_2_GroupNum] FOREIGN KEY ([GroupNum]) REFERENCES [procedurelog] ([ProcNum]);
GO

ALTER TABLE [procmultivisit] ADD CONSTRAINT [fk_procmultivisit_1_GroupProcMultiVisitNum] FOREIGN KEY ([GroupProcMultiVisitNum]) REFERENCES [procmultivisit] ([ProcMultiVisitNum]);
GO

ALTER TABLE [procmultivisit] ADD CONSTRAINT [fk_procmultivisit_2_ProcNum] FOREIGN KEY ([ProcNum]) REFERENCES [procedurelog] ([ProcNum]);
GO

ALTER TABLE [procmultivisit] ADD CONSTRAINT [fk_procmultivisit_3_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [patient] ([PatNum]);
GO

ALTER TABLE [procnote] ADD CONSTRAINT [fk_procnote_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [patient] ([PatNum]);
GO

ALTER TABLE [procnote] ADD CONSTRAINT [fk_procnote_2_ProcNum] FOREIGN KEY ([ProcNum]) REFERENCES [procedurelog] ([ProcNum]);
GO

ALTER TABLE [procnote] ADD CONSTRAINT [fk_procnote_3_UserNum] FOREIGN KEY ([UserNum]) REFERENCES [userod] ([UserNum]);
GO

ALTER TABLE [proctp] ADD CONSTRAINT [fk_proctp_1_TreatPlanNum] FOREIGN KEY ([TreatPlanNum]) REFERENCES [treatplan] ([TreatPlanNum]);
GO

ALTER TABLE [proctp] ADD CONSTRAINT [fk_proctp_2_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [patient] ([PatNum]);
GO

ALTER TABLE [proctp] ADD CONSTRAINT [fk_proctp_3_ProcNumOrig] FOREIGN KEY ([ProcNumOrig]) REFERENCES [procedurelog] ([ProcNum]);
GO

ALTER TABLE [proctp] ADD CONSTRAINT [fk_proctp_4_Priority] FOREIGN KEY ([Priority]) REFERENCES [definition] ([DefNum]);
GO

ALTER TABLE [proctp] ADD CONSTRAINT [fk_proctp_5_SecUserNumEntry] FOREIGN KEY ([SecUserNumEntry]) REFERENCES [userod] ([UserNum]);
GO

ALTER TABLE [proctp] ADD CONSTRAINT [fk_proctp_6_ProvNum] FOREIGN KEY ([ProvNum]) REFERENCES [provider] ([ProvNum]);
GO

ALTER TABLE [proctp] ADD CONSTRAINT [fk_proctp_7_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [clinic] ([ClinicNum]);
GO

ALTER TABLE [programproperty] ADD CONSTRAINT [fk_programproperty_1_ProgramNum] FOREIGN KEY ([ProgramNum]) REFERENCES [program] ([ProgramNum]);
GO

ALTER TABLE [programproperty] ADD CONSTRAINT [fk_programproperty_2_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [clinic] ([ClinicNum]);
GO

ALTER TABLE [promotion] ADD CONSTRAINT [fk_promotion_1_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [clinic] ([ClinicNum]);
GO

ALTER TABLE [promotionlog] ADD CONSTRAINT [fk_promotionlog_1_PromotionNum] FOREIGN KEY ([PromotionNum]) REFERENCES [promotion] ([PromotionNum]);
GO

ALTER TABLE [promotionlog] ADD CONSTRAINT [fk_promotionlog_2_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [patient] ([PatNum]);
GO

ALTER TABLE [promotionlog] ADD CONSTRAINT [fk_promotionlog_3_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [clinic] ([ClinicNum]);
GO

ALTER TABLE [promotionlog] ADD CONSTRAINT [fk_promotionlog_4_ApptReminderRuleNum] FOREIGN KEY ([ApptReminderRuleNum]) REFERENCES [apptreminderrule] ([ApptReminderRuleNum]);
GO

ALTER TABLE [provider] ADD CONSTRAINT [fk_provider_1_FeeSched] FOREIGN KEY ([FeeSched]) REFERENCES [feesched] ([FeeSchedNum]);
GO

ALTER TABLE [provider] ADD CONSTRAINT [fk_provider_2_Specialty] FOREIGN KEY ([Specialty]) REFERENCES [definition] ([DefNum]);
GO

ALTER TABLE [provider] ADD CONSTRAINT [fk_provider_3_SchoolClassNum] FOREIGN KEY ([SchoolClassNum]) REFERENCES [schoolclass] ([SchoolClassNum]);
GO

ALTER TABLE [provider] ADD CONSTRAINT [fk_provider_4_EmailAddressNum] FOREIGN KEY ([EmailAddressNum]) REFERENCES [emailaddress] ([EmailAddressNum]);
GO

ALTER TABLE [provider] ADD CONSTRAINT [fk_provider_5_ProvNumBillingOverride] FOREIGN KEY ([ProvNumBillingOverride]) REFERENCES [provider] ([ProvNum]);
GO

ALTER TABLE [providerclinic] ADD CONSTRAINT [fk_providerclinic_1_ProvNum] FOREIGN KEY ([ProvNum]) REFERENCES [provider] ([ProvNum]);
GO

ALTER TABLE [providerclinic] ADD CONSTRAINT [fk_providerclinic_2_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [clinic] ([ClinicNum]);
GO

ALTER TABLE [providercliniclink] ADD CONSTRAINT [fk_providercliniclink_1_ProvNum] FOREIGN KEY ([ProvNum]) REFERENCES [provider] ([ProvNum]);
GO

ALTER TABLE [providercliniclink] ADD CONSTRAINT [fk_providercliniclink_2_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [clinic] ([ClinicNum]);
GO

ALTER TABLE [providererx] ADD CONSTRAINT [fk_providererx_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [patient] ([PatNum]);
GO

ALTER TABLE [providererx] ADD CONSTRAINT [fk_providererx_2_RegistrationKeyNum] FOREIGN KEY ([RegistrationKeyNum]) REFERENCES [registrationkey] ([RegistrationKeyNum]);
GO

ALTER TABLE [providerident] ADD CONSTRAINT [fk_providerident_1_ProvNum] FOREIGN KEY ([ProvNum]) REFERENCES [provider] ([ProvNum]);
GO

ALTER TABLE [providerident] ADD CONSTRAINT [fk_providerident_2_PayorID] FOREIGN KEY ([PayorID]) REFERENCES [carrier] ([ElectID]);
GO

ALTER TABLE [question] ADD CONSTRAINT [fk_question_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [patient] ([PatNum]);
GO

ALTER TABLE [question] ADD CONSTRAINT [fk_question_2_FormPatNum] FOREIGN KEY ([FormPatNum]) REFERENCES [formpat] ([FormPatNum]);
GO

ALTER TABLE [reactivation] ADD CONSTRAINT [fk_reactivation_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [patient] ([PatNum]);
GO

ALTER TABLE [reactivation] ADD CONSTRAINT [fk_reactivation_2_ReactivationStatus] FOREIGN KEY ([ReactivationStatus]) REFERENCES [definition] ([DefNum]);
GO

ALTER TABLE [recall] ADD CONSTRAINT [fk_recall_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [patient] ([PatNum]);
GO

ALTER TABLE [recall] ADD CONSTRAINT [fk_recall_2_RecallStatus] FOREIGN KEY ([RecallStatus]) REFERENCES [definition] ([DefNum]);
GO

ALTER TABLE [recall] ADD CONSTRAINT [fk_recall_3_RecallTypeNum] FOREIGN KEY ([RecallTypeNum]) REFERENCES [recalltype] ([RecallTypeNum]);
GO

ALTER TABLE [recalltrigger] ADD CONSTRAINT [fk_recalltrigger_1_RecallTypeNum] FOREIGN KEY ([RecallTypeNum]) REFERENCES [recalltype] ([RecallTypeNum]);
GO

ALTER TABLE [recalltrigger] ADD CONSTRAINT [fk_recalltrigger_2_CodeNum] FOREIGN KEY ([CodeNum]) REFERENCES [procedurecode] ([CodeNum]);
GO

ALTER TABLE [recurringcharge] ADD CONSTRAINT [fk_recurringcharge_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [patient] ([PatNum]);
GO

ALTER TABLE [recurringcharge] ADD CONSTRAINT [fk_recurringcharge_2_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [clinic] ([ClinicNum]);
GO

ALTER TABLE [recurringcharge] ADD CONSTRAINT [fk_recurringcharge_3_UserNum] FOREIGN KEY ([UserNum]) REFERENCES [userod] ([UserNum]);
GO

ALTER TABLE [recurringcharge] ADD CONSTRAINT [fk_recurringcharge_4_PayNum] FOREIGN KEY ([PayNum]) REFERENCES [payment] ([PayNum]);
GO

ALTER TABLE [recurringcharge] ADD CONSTRAINT [fk_recurringcharge_5_CreditCardNum] FOREIGN KEY ([CreditCardNum]) REFERENCES [creditcard] ([CreditCardNum]);
GO

ALTER TABLE [refattach] ADD CONSTRAINT [fk_refattach_1_ReferralNum] FOREIGN KEY ([ReferralNum]) REFERENCES [referral] ([ReferralNum]);
GO

ALTER TABLE [refattach] ADD CONSTRAINT [fk_refattach_2_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [patient] ([PatNum]);
GO

ALTER TABLE [refattach] ADD CONSTRAINT [fk_refattach_3_ProcNum] FOREIGN KEY ([ProcNum]) REFERENCES [procedurelog] ([ProcNum]);
GO

ALTER TABLE [refattach] ADD CONSTRAINT [fk_refattach_4_ProvNum] FOREIGN KEY ([ProvNum]) REFERENCES [provider] ([ProvNum]);
GO

ALTER TABLE [referral] ADD CONSTRAINT [fk_referral_1_Specialty] FOREIGN KEY ([Specialty]) REFERENCES [definition] ([DefNum]);
GO

ALTER TABLE [referral] ADD CONSTRAINT [fk_referral_2_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [patient] ([PatNum]);
GO

ALTER TABLE [referral] ADD CONSTRAINT [fk_referral_3_Slip] FOREIGN KEY ([Slip]) REFERENCES [sheetdef] ([SheetDefNum]);
GO

ALTER TABLE [referralcliniclink] ADD CONSTRAINT [fk_referralcliniclink_1_ReferralNum] FOREIGN KEY ([ReferralNum]) REFERENCES [referral] ([ReferralNum]);
GO

ALTER TABLE [referralcliniclink] ADD CONSTRAINT [fk_referralcliniclink_2_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [clinic] ([ClinicNum]);
GO

ALTER TABLE [registrationkey] ADD CONSTRAINT [fk_registrationkey_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [patient] ([PatNum]);
GO

ALTER TABLE [repeatcharge] ADD CONSTRAINT [fk_repeatcharge_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [patient] ([PatNum]);
GO

ALTER TABLE [repeatcharge] ADD CONSTRAINT [fk_repeatcharge_2_ProcCode] FOREIGN KEY ([ProcCode]) REFERENCES [procedurecode] ([ProcCode]);
GO

ALTER TABLE [reqstudent] ADD CONSTRAINT [fk_reqstudent_1_ReqNeededNum] FOREIGN KEY ([ReqNeededNum]) REFERENCES [reqneeded] ([ReqNeededNum]);
GO

ALTER TABLE [reqstudent] ADD CONSTRAINT [fk_reqstudent_2_SchoolCourseNum] FOREIGN KEY ([SchoolCourseNum]) REFERENCES [schoolcourse] ([SchoolCourseNum]);
GO

ALTER TABLE [reqstudent] ADD CONSTRAINT [fk_reqstudent_3_ProvNum] FOREIGN KEY ([ProvNum]) REFERENCES [provider] ([ProvNum]);
GO

ALTER TABLE [reqstudent] ADD CONSTRAINT [fk_reqstudent_4_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [patient] ([PatNum]);
GO

ALTER TABLE [reqstudent] ADD CONSTRAINT [fk_reqstudent_5_InstructorNum] FOREIGN KEY ([InstructorNum]) REFERENCES [provider] ([ProvNum]);
GO

ALTER TABLE [reqstudent] ADD CONSTRAINT [fk_reqstudent_6_ProcNum] FOREIGN KEY ([ProcNum]) REFERENCES [procedurelog] ([ProcNum]);
GO

ALTER TABLE [rxpat] ADD CONSTRAINT [fk_rxpat_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [patient] ([PatNum]);
GO

ALTER TABLE [rxpat] ADD CONSTRAINT [fk_rxpat_2_ProvNum] FOREIGN KEY ([ProvNum]) REFERENCES [provider] ([ProvNum]);
GO

ALTER TABLE [rxpat] ADD CONSTRAINT [fk_rxpat_3_PharmacyNum] FOREIGN KEY ([PharmacyNum]) REFERENCES [pharmacy] ([PharmacyNum]);
GO

ALTER TABLE [rxpat] ADD CONSTRAINT [fk_rxpat_4_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [clinic] ([ClinicNum]);
GO

ALTER TABLE [rxpat] ADD CONSTRAINT [fk_rxpat_5_UserNum] FOREIGN KEY ([UserNum]) REFERENCES [userod] ([UserNum]);
GO

ALTER TABLE [schedule] ADD CONSTRAINT [fk_schedule_1_ProvNum] FOREIGN KEY ([ProvNum]) REFERENCES [provider] ([ProvNum]);
GO

ALTER TABLE [schedule] ADD CONSTRAINT [fk_schedule_2_BlockoutType] FOREIGN KEY ([BlockoutType]) REFERENCES [definition] ([DefNum]);
GO

ALTER TABLE [schedule] ADD CONSTRAINT [fk_schedule_3_EmployeeNum] FOREIGN KEY ([EmployeeNum]) REFERENCES [employee] ([EmployeeNum]);
GO

ALTER TABLE [schedule] ADD CONSTRAINT [fk_schedule_4_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [clinic] ([ClinicNum]);
GO

ALTER TABLE [scheduleop] ADD CONSTRAINT [fk_scheduleop_1_ScheduleNum] FOREIGN KEY ([ScheduleNum]) REFERENCES [schedule] ([ScheduleNum]);
GO

ALTER TABLE [scheduleop] ADD CONSTRAINT [fk_scheduleop_2_OperatoryNum] FOREIGN KEY ([OperatoryNum]) REFERENCES [operatory] ([OperatoryNum]);
GO

ALTER TABLE [schoolapproval] ADD CONSTRAINT [fk_schoolapproval_1_ProvNum] FOREIGN KEY ([ProvNum]) REFERENCES [provider] ([ProvNum]);
GO

ALTER TABLE [schoolapproval] ADD CONSTRAINT [fk_schoolapproval_2_InstructorNum] FOREIGN KEY ([InstructorNum]) REFERENCES [provider] ([ProvNum]);
GO

ALTER TABLE [schoolapproval] ADD CONSTRAINT [fk_schoolapproval_3_AptNum] FOREIGN KEY ([AptNum]) REFERENCES [appointment] ([AptNum]);
GO

ALTER TABLE [schoolapproval] ADD CONSTRAINT [fk_schoolapproval_4_ProcNum] FOREIGN KEY ([ProcNum]) REFERENCES [procedurelog] ([ProcNum]);
GO

ALTER TABLE [schoolapproval] ADD CONSTRAINT [fk_schoolapproval_5_TreatPlanNum] FOREIGN KEY ([TreatPlanNum]) REFERENCES [treatplan] ([TreatPlanNum]);
GO

ALTER TABLE [schoolapproval] ADD CONSTRAINT [fk_schoolapproval_6_PerioExamNum] FOREIGN KEY ([PerioExamNum]) REFERENCES [perioexam] ([PerioExamNum]);
GO

ALTER TABLE [schoolapproval] ADD CONSTRAINT [fk_schoolapproval_7_AllergyNum] FOREIGN KEY ([AllergyNum]) REFERENCES [allergy] ([AllergyNum]);
GO

ALTER TABLE [schoolapproval] ADD CONSTRAINT [fk_schoolapproval_8_DiseaseNum] FOREIGN KEY ([DiseaseNum]) REFERENCES [disease] ([DiseaseNum]);
GO

ALTER TABLE [schoolapproval] ADD CONSTRAINT [fk_schoolapproval_9_DocNum] FOREIGN KEY ([DocNum]) REFERENCES [document] ([DocNum]);
GO

ALTER TABLE [schoolapproval] ADD CONSTRAINT [fk_schoolapproval_10_MountNum] FOREIGN KEY ([MountNum]) REFERENCES [mount] ([MountNum]);
GO

ALTER TABLE [schoolcourseenrollee] ADD CONSTRAINT [fk_schoolcourseenrollee_1_SchoolCourseNum] FOREIGN KEY ([SchoolCourseNum]) REFERENCES [schoolcourse] ([SchoolCourseNum]);
GO

ALTER TABLE [schoolcourseenrollee] ADD CONSTRAINT [fk_schoolcourseenrollee_2_StudentNum] FOREIGN KEY ([StudentNum]) REFERENCES [provider] ([ProvNum]);
GO

ALTER TABLE [schoolcourseinstructor] ADD CONSTRAINT [fk_schoolcourseinstructor_1_SchoolCourseNum] FOREIGN KEY ([SchoolCourseNum]) REFERENCES [schoolcourse] ([SchoolCourseNum]);
GO

ALTER TABLE [schoolcourseinstructor] ADD CONSTRAINT [fk_schoolcourseinstructor_2_InstructorNum] FOREIGN KEY ([InstructorNum]) REFERENCES [provider] ([ProvNum]);
GO

ALTER TABLE [screen] ADD CONSTRAINT [fk_screen_1_ScreenGroupNum] FOREIGN KEY ([ScreenGroupNum]) REFERENCES [screengroup] ([ScreenGroupNum]);
GO

ALTER TABLE [screen] ADD CONSTRAINT [fk_screen_2_ScreenPatNum] FOREIGN KEY ([ScreenPatNum]) REFERENCES [screenpat] ([ScreenPatNum]);
GO

ALTER TABLE [screen] ADD CONSTRAINT [fk_screen_3_SheetNum] FOREIGN KEY ([SheetNum]) REFERENCES [sheet] ([SheetNum]);
GO

ALTER TABLE [screengroup] ADD CONSTRAINT [fk_screengroup_1_ProvNum] FOREIGN KEY ([ProvNum]) REFERENCES [provider] ([ProvNum]);
GO

ALTER TABLE [screengroup] ADD CONSTRAINT [fk_screengroup_2_County] FOREIGN KEY ([County]) REFERENCES [county] ([CountyName]);
GO

ALTER TABLE [screengroup] ADD CONSTRAINT [fk_screengroup_3_GradeSchool] FOREIGN KEY ([GradeSchool]) REFERENCES [site] ([Description]);
GO

ALTER TABLE [screengroup] ADD CONSTRAINT [fk_screengroup_4_SheetDefNum] FOREIGN KEY ([SheetDefNum]) REFERENCES [sheetdef] ([SheetDefNum]);
GO

ALTER TABLE [screenpat] ADD CONSTRAINT [fk_screenpat_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [patient] ([PatNum]);
GO

ALTER TABLE [screenpat] ADD CONSTRAINT [fk_screenpat_2_ScreenGroupNum] FOREIGN KEY ([ScreenGroupNum]) REFERENCES [screengroup] ([ScreenGroupNum]);
GO

ALTER TABLE [screenpat] ADD CONSTRAINT [fk_screenpat_3_SheetNum] FOREIGN KEY ([SheetNum]) REFERENCES [sheetdef] ([SheetDefNum]);
GO

ALTER TABLE [securitylog] ADD CONSTRAINT [fk_securitylog_1_UserNum] FOREIGN KEY ([UserNum]) REFERENCES [userod] ([UserNum]);
GO

ALTER TABLE [securitylog] ADD CONSTRAINT [fk_securitylog_2_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [patient] ([PatNum]);
GO

ALTER TABLE [securityloghash] ADD CONSTRAINT [fk_securityloghash_1_SecurityLogNum] FOREIGN KEY ([SecurityLogNum]) REFERENCES [securitylog] ([SecurityLogNum]);
GO

ALTER TABLE [sheet] ADD CONSTRAINT [fk_sheet_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [patient] ([PatNum]);
GO

ALTER TABLE [sheet] ADD CONSTRAINT [fk_sheet_2_SheetDefNum] FOREIGN KEY ([SheetDefNum]) REFERENCES [sheetdef] ([SheetDefNum]);
GO

ALTER TABLE [sheet] ADD CONSTRAINT [fk_sheet_3_DocNum] FOREIGN KEY ([DocNum]) REFERENCES [document] ([DocNum]);
GO

ALTER TABLE [sheet] ADD CONSTRAINT [fk_sheet_4_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [clinic] ([ClinicNum]);
GO

GO

ALTER TABLE [sheetfield] ADD CONSTRAINT [fk_sheetfield_1_SheetNum] FOREIGN KEY ([SheetNum]) REFERENCES [sheet] ([SheetNum]);
GO

GO

ALTER TABLE [sheetfield] ADD CONSTRAINT [fk_sheetfield_3_SheetFieldDefNum] FOREIGN KEY ([SheetFieldDefNum]) REFERENCES [sheetfielddef] ([SheetFieldDefNum]);
GO

ALTER TABLE [sheetfield] ADD CONSTRAINT [fk_sheetfield_4_UserSigned] FOREIGN KEY ([UserSigned]) REFERENCES [userod] ([UserNum]);
GO

ALTER TABLE [site] ADD CONSTRAINT [fk_site_1_ProvNum] FOREIGN KEY ([ProvNum]) REFERENCES [provider] ([ProvNum]);
GO

ALTER TABLE [smsfrommobile] ADD CONSTRAINT [fk_smsfrommobile_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [patient] ([PatNum]);
GO

ALTER TABLE [smsfrommobile] ADD CONSTRAINT [fk_smsfrommobile_2_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [clinic] ([ClinicNum]);
GO

ALTER TABLE [smsfrommobile] ADD CONSTRAINT [fk_smsfrommobile_3_CommlogNum] FOREIGN KEY ([CommlogNum]) REFERENCES [commlog] ([CommlogNum]);
GO

ALTER TABLE [smsfrommobile] ADD CONSTRAINT [fk_smsfrommobile_4_GuidMessage] FOREIGN KEY ([GuidMessage]) REFERENCES [confirmationrequest] ([GuidMessageFromMobile]);
GO

ALTER TABLE [smsphone] ADD CONSTRAINT [fk_smsphone_1_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [clinic] ([ClinicNum]);
GO

ALTER TABLE [smstomobile] ADD CONSTRAINT [fk_smstomobile_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [patient] ([PatNum]);
GO

ALTER TABLE [smstomobile] ADD CONSTRAINT [fk_smstomobile_2_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [clinic] ([ClinicNum]);
GO

ALTER TABLE [statement] ADD CONSTRAINT [fk_statement_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [patient] ([PatNum]);
GO

ALTER TABLE [statement] ADD CONSTRAINT [fk_statement_2_DocNum] FOREIGN KEY ([DocNum]) REFERENCES [document] ([DocNum]);
GO

ALTER TABLE [statement] ADD CONSTRAINT [fk_statement_3_SuperFamily] FOREIGN KEY ([SuperFamily]) REFERENCES [patient] ([PatNum]);
GO

ALTER TABLE [statementprod] ADD CONSTRAINT [fk_statementprod_1_StatementNum] FOREIGN KEY ([StatementNum]) REFERENCES [statement] ([StatementNum]);
GO

ALTER TABLE [statementprod] ADD CONSTRAINT [fk_statementprod_2_LateChargeAdjNum] FOREIGN KEY ([LateChargeAdjNum]) REFERENCES [adjustment] ([AdjNum]);
GO

ALTER TABLE [statementprod] ADD CONSTRAINT [fk_statementprod_3_DocNum] FOREIGN KEY ([DocNum]) REFERENCES [document] ([DocNum]);
GO

ALTER TABLE [stmtlink] ADD CONSTRAINT [fk_stmtlink_1_StatementNum] FOREIGN KEY ([StatementNum]) REFERENCES [statement] ([StatementNum]);
GO

ALTER TABLE [substitutionlink] ADD CONSTRAINT [fk_substitutionlink_1_PlanNum] FOREIGN KEY ([PlanNum]) REFERENCES [insplan] ([PlanNum]);
GO

ALTER TABLE [substitutionlink] ADD CONSTRAINT [fk_substitutionlink_2_CodeNum] FOREIGN KEY ([CodeNum]) REFERENCES [procedurecode] ([CodeNum]);
GO

ALTER TABLE [substitutionlink] ADD CONSTRAINT [fk_substitutionlink_3_SubstitutionCode] FOREIGN KEY ([SubstitutionCode]) REFERENCES [procedurecode] ([ProcCode]);
GO

ALTER TABLE [supplyorder] ADD CONSTRAINT [fk_supplyorder_1_SupplierNum] FOREIGN KEY ([SupplierNum]) REFERENCES [supplier] ([SupplierNum]);
GO

ALTER TABLE [supplyorder] ADD CONSTRAINT [fk_supplyorder_2_UserNum] FOREIGN KEY ([UserNum]) REFERENCES [userod] ([UserNum]);
GO

ALTER TABLE [supplyorderitem] ADD CONSTRAINT [fk_supplyorderitem_1_SupplyOrderNum] FOREIGN KEY ([SupplyOrderNum]) REFERENCES [supplyorder] ([supplyOrderNum]);
GO

ALTER TABLE [supplyorderitem] ADD CONSTRAINT [fk_supplyorderitem_2_SupplyNum] FOREIGN KEY ([SupplyNum]) REFERENCES [supply] ([SupplyNum]);
GO

ALTER TABLE [task] ADD CONSTRAINT [fk_task_1_TaskListNum] FOREIGN KEY ([TaskListNum]) REFERENCES [tasklist] ([TaskListNum]);
GO

ALTER TABLE [task] ADD CONSTRAINT [fk_task_2_KeyNum] FOREIGN KEY ([KeyNum]) REFERENCES [patient] ([PatNum]);
GO

ALTER TABLE [task] ADD CONSTRAINT [fk_task_3_FromNum] FOREIGN KEY ([FromNum]) REFERENCES [task] ([TaskNum]);
GO

ALTER TABLE [task] ADD CONSTRAINT [fk_task_4_UserNum] FOREIGN KEY ([UserNum]) REFERENCES [userod] ([UserNum]);
GO

ALTER TABLE [task] ADD CONSTRAINT [fk_task_5_PriorityDefNum] FOREIGN KEY ([PriorityDefNum]) REFERENCES [definition] ([DefNum]);
GO

ALTER TABLE [task] ADD CONSTRAINT [fk_task_6_Category] FOREIGN KEY ([Category]) REFERENCES [definition] ([DefNum]);
GO

ALTER TABLE [taskancestor] ADD CONSTRAINT [fk_taskancestor_1_TaskNum] FOREIGN KEY ([TaskNum]) REFERENCES [task] ([TaskNum]);
GO

ALTER TABLE [taskancestor] ADD CONSTRAINT [fk_taskancestor_2_TaskListNum] FOREIGN KEY ([TaskListNum]) REFERENCES [tasklist] ([TaskListNum]);
GO

ALTER TABLE [taskattachment] ADD CONSTRAINT [fk_taskattachment_1_TaskNum] FOREIGN KEY ([TaskNum]) REFERENCES [task] ([TaskNum]);
GO

ALTER TABLE [taskattachment] ADD CONSTRAINT [fk_taskattachment_2_DocNum] FOREIGN KEY ([DocNum]) REFERENCES [document] ([DocNum]);
GO

ALTER TABLE [taskhist] ADD CONSTRAINT [fk_taskhist_1_UserNumHist] FOREIGN KEY ([UserNumHist]) REFERENCES [userod] ([UserNum]);
GO

ALTER TABLE [tasknote] ADD CONSTRAINT [fk_tasknote_1_TaskNum] FOREIGN KEY ([TaskNum]) REFERENCES [task] ([TaskNum]);
GO

ALTER TABLE [tasknote] ADD CONSTRAINT [fk_tasknote_2_UserNum] FOREIGN KEY ([UserNum]) REFERENCES [userod] ([UserNum]);
GO

ALTER TABLE [tasksubscription] ADD CONSTRAINT [fk_tasksubscription_1_UserNum] FOREIGN KEY ([UserNum]) REFERENCES [userod] ([UserNum]);
GO

ALTER TABLE [tasksubscription] ADD CONSTRAINT [fk_tasksubscription_2_TaskListNum] FOREIGN KEY ([TaskListNum]) REFERENCES [tasklist] ([TaskListNum]);
GO

ALTER TABLE [tasksubscription] ADD CONSTRAINT [fk_tasksubscription_3_TaskNum] FOREIGN KEY ([TaskNum]) REFERENCES [task] ([TaskNum]);
GO

ALTER TABLE [taskunread] ADD CONSTRAINT [fk_taskunread_1_TaskNum] FOREIGN KEY ([TaskNum]) REFERENCES [task] ([TaskNum]);
GO

ALTER TABLE [taskunread] ADD CONSTRAINT [fk_taskunread_2_UserNum] FOREIGN KEY ([UserNum]) REFERENCES [userod] ([UserNum]);
GO

ALTER TABLE [terminalactive] ADD CONSTRAINT [fk_terminalactive_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [patient] ([PatNum]);
GO

ALTER TABLE [timeadjust] ADD CONSTRAINT [fk_timeadjust_1_EmployeeNum] FOREIGN KEY ([EmployeeNum]) REFERENCES [employee] ([EmployeeNum]);
GO

ALTER TABLE [timeadjust] ADD CONSTRAINT [fk_timeadjust_2_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [clinic] ([ClinicNum]);
GO

ALTER TABLE [timeadjust] ADD CONSTRAINT [fk_timeadjust_3_PtoDefNum] FOREIGN KEY ([PtoDefNum]) REFERENCES [definition] ([DefNum]);
GO

ALTER TABLE [timeadjust] ADD CONSTRAINT [fk_timeadjust_4_SecuUserNumEntry] FOREIGN KEY ([SecuUserNumEntry]) REFERENCES [userod] ([UserNum]);
GO

ALTER TABLE [toothgridcell] ADD CONSTRAINT [fk_toothgridcell_1_SheetFieldNum] FOREIGN KEY ([SheetFieldNum]) REFERENCES [sheetfield] ([SheetFieldNum]);
GO

ALTER TABLE [toothgridcell] ADD CONSTRAINT [fk_toothgridcell_2_ToothGridColNum] FOREIGN KEY ([ToothGridColNum]) REFERENCES [toothgridcol] ([ToothGridColNum]);
GO

ALTER TABLE [toothgridcol] ADD CONSTRAINT [fk_toothgridcol_1_SheetFieldNum] FOREIGN KEY ([SheetFieldNum]) REFERENCES [sheetfield] ([SheetFieldNum]);
GO

ALTER TABLE [toothgridcol] ADD CONSTRAINT [fk_toothgridcol_2_CodeNum] FOREIGN KEY ([CodeNum]) REFERENCES [procedurecode] ([CodeNum]);
GO

ALTER TABLE [toothgriddef] ADD CONSTRAINT [fk_toothgriddef_1_CodeNum] FOREIGN KEY ([CodeNum]) REFERENCES [procedurecode] ([CodeNum]);
GO

ALTER TABLE [toothgriddef] ADD CONSTRAINT [fk_toothgriddef_2_SheetFieldDefNum] FOREIGN KEY ([SheetFieldDefNum]) REFERENCES [sheetfielddef] ([SheetFieldDefNum]);
GO

ALTER TABLE [toothinitial] ADD CONSTRAINT [fk_toothinitial_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [patient] ([PatNum]);
GO

ALTER TABLE [transaction] ADD CONSTRAINT [fk_transaction_1_UserNum] FOREIGN KEY ([UserNum]) REFERENCES [userod] ([UserNum]);
GO

ALTER TABLE [transaction] ADD CONSTRAINT [fk_transaction_2_DepositNum] FOREIGN KEY ([DepositNum]) REFERENCES [deposit] ([DepositNum]);
GO

ALTER TABLE [transaction] ADD CONSTRAINT [fk_transaction_3_PayNum] FOREIGN KEY ([PayNum]) REFERENCES [payment] ([PayNum]);
GO

ALTER TABLE [transaction] ADD CONSTRAINT [fk_transaction_4_SecUserNumEdit] FOREIGN KEY ([SecUserNumEdit]) REFERENCES [userod] ([UserNum]);
GO

ALTER TABLE [transaction] ADD CONSTRAINT [fk_transaction_5_TransactionInvoiceNum] FOREIGN KEY ([TransactionInvoiceNum]) REFERENCES [transactioninvoice] ([TransactionInvoiceNum]);
GO

ALTER TABLE [treatplan] ADD CONSTRAINT [fk_treatplan_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [patient] ([PatNum]);
GO

ALTER TABLE [treatplan] ADD CONSTRAINT [fk_treatplan_2_ResponsParty] FOREIGN KEY ([ResponsParty]) REFERENCES [patient] ([PatNum]);
GO

ALTER TABLE [treatplan] ADD CONSTRAINT [fk_treatplan_3_DocNum] FOREIGN KEY ([DocNum]) REFERENCES [document] ([DocNum]);
GO

ALTER TABLE [treatplan] ADD CONSTRAINT [fk_treatplan_4_SecUserNumEntry] FOREIGN KEY ([SecUserNumEntry]) REFERENCES [userod] ([UserNum]);
GO

ALTER TABLE [treatplan] ADD CONSTRAINT [fk_treatplan_5_UserNumPresenter] FOREIGN KEY ([UserNumPresenter]) REFERENCES [userod] ([UserNum]);
GO

ALTER TABLE [treatplan] ADD CONSTRAINT [fk_treatplan_6_MobileAppDeviceNum] FOREIGN KEY ([MobileAppDeviceNum]) REFERENCES [mobileappdevice] ([MobileAppDeviceNum]);
GO

ALTER TABLE [treatplanattach] ADD CONSTRAINT [fk_treatplanattach_1_TreatPlanNum] FOREIGN KEY ([TreatPlanNum]) REFERENCES [treatplan] ([TreatPlanNum]);
GO

ALTER TABLE [treatplanattach] ADD CONSTRAINT [fk_treatplanattach_2_ProcNum] FOREIGN KEY ([ProcNum]) REFERENCES [procedurelog] ([ProcNum]);
GO

ALTER TABLE [treatplanattach] ADD CONSTRAINT [fk_treatplanattach_3_Priority] FOREIGN KEY ([Priority]) REFERENCES [definition] ([DefNum]);
GO

ALTER TABLE [treatplanparam] ADD CONSTRAINT [fk_treatplanparam_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [patient] ([PatNum]);
GO

ALTER TABLE [treatplanparam] ADD CONSTRAINT [fk_treatplanparam_2_TreatPlanNum] FOREIGN KEY ([TreatPlanNum]) REFERENCES [treatplan] ([TreatPlanNum]);
GO

ALTER TABLE [tsitranslog] ADD CONSTRAINT [fk_tsitranslog_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [patient] ([PatNum]);
GO

ALTER TABLE [tsitranslog] ADD CONSTRAINT [fk_tsitranslog_2_UserNum] FOREIGN KEY ([UserNum]) REFERENCES [userod] ([UserNum]);
GO

ALTER TABLE [tsitranslog] ADD CONSTRAINT [fk_tsitranslog_3_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [clinic] ([ClinicNum]);
GO

ALTER TABLE [tsitranslog] ADD CONSTRAINT [fk_tsitranslog_4_AggTransLogNum] FOREIGN KEY ([AggTransLogNum]) REFERENCES [tsitranslog] ([TsiTransLogNum]);
GO

ALTER TABLE [userclinic] ADD CONSTRAINT [fk_userclinic_1_UserNum] FOREIGN KEY ([UserNum]) REFERENCES [userod] ([UserNum]);
GO

ALTER TABLE [userclinic] ADD CONSTRAINT [fk_userclinic_2_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [clinic] ([ClinicNum]);
GO

ALTER TABLE [usergroupattach] ADD CONSTRAINT [fk_usergroupattach_1_UserNum] FOREIGN KEY ([UserNum]) REFERENCES [userod] ([UserNum]);
GO

ALTER TABLE [usergroupattach] ADD CONSTRAINT [fk_usergroupattach_2_UserGroupNum] FOREIGN KEY ([UserGroupNum]) REFERENCES [usergroup] ([UserGroupNum]);
GO

ALTER TABLE [userod] ADD CONSTRAINT [fk_userod_1_EmployeeNum] FOREIGN KEY ([EmployeeNum]) REFERENCES [employee] ([EmployeeNum]);
GO

ALTER TABLE [userod] ADD CONSTRAINT [fk_userod_2_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [clinic] ([ClinicNum]);
GO

ALTER TABLE [userod] ADD CONSTRAINT [fk_userod_3_ProvNum] FOREIGN KEY ([ProvNum]) REFERENCES [provider] ([ProvNum]);
GO

ALTER TABLE [userod] ADD CONSTRAINT [fk_userod_4_TaskListInBox] FOREIGN KEY ([TaskListInBox]) REFERENCES [tasklist] ([TaskListNum]);
GO

ALTER TABLE [userod] ADD CONSTRAINT [fk_userod_5_UserNumCEMT] FOREIGN KEY ([UserNumCEMT]) REFERENCES [userod] ([UserNum]);
GO

ALTER TABLE [userodapptview] ADD CONSTRAINT [fk_userodapptview_1_UserNum] FOREIGN KEY ([UserNum]) REFERENCES [userod] ([UserNum]);
GO

ALTER TABLE [userodapptview] ADD CONSTRAINT [fk_userodapptview_2_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [clinic] ([ClinicNum]);
GO

ALTER TABLE [userodapptview] ADD CONSTRAINT [fk_userodapptview_3_ApptViewNum] FOREIGN KEY ([ApptViewNum]) REFERENCES [apptview] ([ApptViewNum]);
GO

ALTER TABLE [userodpref] ADD CONSTRAINT [fk_userodpref_1_UserNum] FOREIGN KEY ([UserNum]) REFERENCES [userod] ([UserNum]);
GO

ALTER TABLE [userodpref] ADD CONSTRAINT [fk_userodpref_2_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [clinic] ([ClinicNum]);
GO

ALTER TABLE [vaccineobs] ADD CONSTRAINT [fk_vaccineobs_1_VaccinePatNum] FOREIGN KEY ([VaccinePatNum]) REFERENCES [vaccinepat] ([VaccinePatNum]);
GO

ALTER TABLE [vaccineobs] ADD CONSTRAINT [fk_vaccineobs_2_VaccineObsNumGroup] FOREIGN KEY ([VaccineObsNumGroup]) REFERENCES [vaccineobs] ([VaccineObsNum]);
GO

ALTER TABLE [vaccinepat] ADD CONSTRAINT [fk_vaccinepat_1_VaccineDefNum] FOREIGN KEY ([VaccineDefNum]) REFERENCES [vaccinedef] ([VaccineDefNum]);
GO

ALTER TABLE [vaccinepat] ADD CONSTRAINT [fk_vaccinepat_2_DrugUnitNum] FOREIGN KEY ([DrugUnitNum]) REFERENCES [drugunit] ([DrugUnitNum]);
GO

ALTER TABLE [vaccinepat] ADD CONSTRAINT [fk_vaccinepat_3_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [patient] ([PatNum]);
GO

ALTER TABLE [vaccinepat] ADD CONSTRAINT [fk_vaccinepat_4_UserNum] FOREIGN KEY ([UserNum]) REFERENCES [userod] ([UserNum]);
GO

ALTER TABLE [vaccinepat] ADD CONSTRAINT [fk_vaccinepat_5_ProvNumOrdering] FOREIGN KEY ([ProvNumOrdering]) REFERENCES [provider] ([ProvNum]);
GO

ALTER TABLE [vaccinepat] ADD CONSTRAINT [fk_vaccinepat_6_ProvNumAdminister] FOREIGN KEY ([ProvNumAdminister]) REFERENCES [provider] ([ProvNum]);
GO

ALTER TABLE [vitalsign] ADD CONSTRAINT [fk_vitalsign_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [patient] ([PatNum]);
GO

ALTER TABLE [vitalsign] ADD CONSTRAINT [fk_vitalsign_2_HeightExamCode] FOREIGN KEY ([HeightExamCode]) REFERENCES [ehrcode] ([CodeValue]);
GO

ALTER TABLE [vitalsign] ADD CONSTRAINT [fk_vitalsign_3_HeightExamCode] FOREIGN KEY ([HeightExamCode]) REFERENCES [loinc] ([LoincCode]);
GO

ALTER TABLE [vitalsign] ADD CONSTRAINT [fk_vitalsign_4_WeightExamCode] FOREIGN KEY ([WeightExamCode]) REFERENCES [ehrcode] ([CodeValue]);
GO

ALTER TABLE [vitalsign] ADD CONSTRAINT [fk_vitalsign_5_WeightExamCode] FOREIGN KEY ([WeightExamCode]) REFERENCES [loinc] ([LoincCode]);
GO

ALTER TABLE [vitalsign] ADD CONSTRAINT [fk_vitalsign_6_BMIExamCode] FOREIGN KEY ([BMIExamCode]) REFERENCES [ehrcode] ([CodeValue]);
GO

ALTER TABLE [vitalsign] ADD CONSTRAINT [fk_vitalsign_7_BMIExamCode] FOREIGN KEY ([BMIExamCode]) REFERENCES [loinc] ([LoincCode]);
GO

ALTER TABLE [vitalsign] ADD CONSTRAINT [fk_vitalsign_8_EhrNotPerformedNum] FOREIGN KEY ([EhrNotPerformedNum]) REFERENCES [ehrnotperformed] ([EhrNotPerformedNum]);
GO

ALTER TABLE [vitalsign] ADD CONSTRAINT [fk_vitalsign_9_PregDiseaseNum] FOREIGN KEY ([PregDiseaseNum]) REFERENCES [disease] ([DiseaseNum]);
GO

ALTER TABLE [webschedcarrierrule] ADD CONSTRAINT [fk_webschedcarrierrule_1_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [clinic] ([ClinicNum]);
GO

ALTER TABLE [webschedrecall] ADD CONSTRAINT [fk_webschedrecall_1_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [clinic] ([ClinicNum]);
GO

ALTER TABLE [webschedrecall] ADD CONSTRAINT [fk_webschedrecall_2_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [patient] ([PatNum]);
GO

ALTER TABLE [webschedrecall] ADD CONSTRAINT [fk_webschedrecall_3_RecallNum] FOREIGN KEY ([RecallNum]) REFERENCES [recall] ([RecallNum]);
GO

ALTER TABLE [webschedrecall] ADD CONSTRAINT [fk_webschedrecall_4_CommlogNum] FOREIGN KEY ([CommlogNum]) REFERENCES [commlog] ([CommlogNum]);
GO

ALTER TABLE [webschedrecall] ADD CONSTRAINT [fk_webschedrecall_5_ApptReminderRuleNum] FOREIGN KEY ([ApptReminderRuleNum]) REFERENCES [apptreminderrule] ([ApptReminderRuleNum]);
GO

ALTER TABLE [wikilisthist] ADD CONSTRAINT [fk_wikilisthist_1_UserNum] FOREIGN KEY ([UserNum]) REFERENCES [userod] ([UserNum]);
GO

ALTER TABLE [wikipage] ADD CONSTRAINT [fk_wikipage_1_UserNum] FOREIGN KEY ([UserNum]) REFERENCES [userod] ([UserNum]);
GO

ALTER TABLE [wikipagehist] ADD CONSTRAINT [fk_wikipagehist_1_UserNum] FOREIGN KEY ([UserNum]) REFERENCES [userod] ([UserNum]);
GO

ALTER TABLE [xchargetransaction] ADD CONSTRAINT [fk_xchargetransaction_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [patient] ([PatNum]);
GO

ALTER TABLE [xwebresponse] ADD CONSTRAINT [fk_xwebresponse_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [patient] ([PatNum]);
GO

ALTER TABLE [xwebresponse] ADD CONSTRAINT [fk_xwebresponse_2_ProvNum] FOREIGN KEY ([ProvNum]) REFERENCES [provider] ([ProvNum]);
GO

ALTER TABLE [xwebresponse] ADD CONSTRAINT [fk_xwebresponse_3_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [clinic] ([ClinicNum]);
GO

ALTER TABLE [xwebresponse] ADD CONSTRAINT [fk_xwebresponse_4_PaymentNum] FOREIGN KEY ([PaymentNum]) REFERENCES [payment] ([PayNum]);
